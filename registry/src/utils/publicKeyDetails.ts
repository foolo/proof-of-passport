import { fromBER, BitString } from 'asn1js';
import * as asn1 from 'asn1js';
import * as forge from 'node-forge';
import { PublicKeyDetailsECDSA, PublicKeyDetailsRSA, PublicKeyDetailsRSAPSS } from './dataStructure';
import { identifyCurve, StandardCurve, getNamedCurve, getECDSACurveBits } from './curves';
import { getHashAlgorithmName } from './utils';

export function parseRsaPublicKey(subjectPublicKeyInfo: any): PublicKeyDetailsRSA {
    const publicKey = subjectPublicKeyInfo.subjectPublicKey;
    const asn1PublicKey = fromBER(publicKey.valueBlock.valueHexView);
    const rsaPublicKey = asn1PublicKey.result.valueBlock;

    if (rsaPublicKey && (rsaPublicKey as any).value && (rsaPublicKey as any).value[0] && (rsaPublicKey as any).value[1]) {
        const modulusAsn1 = (rsaPublicKey as any).value[0];
        const exponentAsn1 = (rsaPublicKey as any).value[1];
        const modulusHex = Buffer.from(modulusAsn1.valueBlock.valueHexView).toString('hex');
        const exponentHex = Buffer.from(exponentAsn1.valueBlock.valueHexView).toString('hex');

        const publicKeyForge = forge.pki.rsa.setPublicKey(
            new forge.jsbn.BigInteger(modulusHex, 16),
            new forge.jsbn.BigInteger(exponentHex, 16)
        );
        const publicKeyDetailsRSA: PublicKeyDetailsRSA = {
            modulus: publicKeyForge.n.toString(16),
            exponent: publicKeyForge.e.toString(10),
            bits: publicKeyForge.n.bitLength().toString()
        };
        return publicKeyDetailsRSA;
    }
    else {
        return null;
    }
}

export function parseECParameters(publicKeyInfo: any): PublicKeyDetailsECDSA {
    try {
        const algorithmParams = publicKeyInfo.algorithm.algorithmParams;
        if (!algorithmParams) {
            console.log('No algorithm params found');
            return { curve: 'Unknown', params: {} as StandardCurve, bits: 'Unknown' };
        }

        const params = asn1.fromBER(algorithmParams.valueBeforeDecodeView).result;
        const valueBlock: any = params.valueBlock;

        if (valueBlock.value && valueBlock.value.length >= 6) {
            const curveParams: StandardCurve = {} as StandardCurve;
            // Field ID (index 1)
            const fieldId = valueBlock.value[1];
            if (fieldId && fieldId.valueBlock && fieldId.valueBlock.value) {
                const fieldType = fieldId.valueBlock.value[0];
                const prime = fieldId.valueBlock.value[1];
                //curveParams.fieldType = fieldType.valueBlock.toString();
                curveParams.p = Buffer.from(prime.valueBlock.valueHexView).toString('hex');
            }

            // Curve Coefficients (index 2)
            const curveCoefficients = valueBlock.value[2];
            if (curveCoefficients && curveCoefficients.valueBlock && curveCoefficients.valueBlock.value) {
                const a = curveCoefficients.valueBlock.value[0];
                const b = curveCoefficients.valueBlock.value[1];
                curveParams.a = Buffer.from(a.valueBlock.valueHexView).toString('hex');
                curveParams.b = Buffer.from(b.valueBlock.valueHexView).toString('hex');
            }

            // Base Point G (index 3)
            const basePoint = valueBlock.value[3];
            if (basePoint && basePoint.valueBlock) {
                curveParams.G = Buffer.from(basePoint.valueBlock.valueHexView).toString('hex');
            }

            // Order n (index 4)
            const order = valueBlock.value[4];
            if (order && order.valueBlock) {
                curveParams.n = Buffer.from(order.valueBlock.valueHexView).toString('hex');
            }

            // Cofactor h (index 5)
            const cofactor = valueBlock.value[5];
            if (cofactor && cofactor.valueBlock) {
                curveParams.h = Buffer.from(cofactor.valueBlock.valueHexView).toString('hex');
            }

            const identifiedCurve = identifyCurve(curveParams);
            return { curve: identifiedCurve, params: curveParams, bits: getECDSACurveBits(identifiedCurve) };
        } else {
            if (valueBlock.value) {

                if (algorithmParams.idBlock.tagNumber === 6) {
                    console.log('\x1b[33malgorithmParams.idBlock.tagNumber === 6, looking for algorithmParams.valueBlock\x1b[0m');

                    const curveOid = algorithmParams.valueBlock.toString();
                    const curveName = getNamedCurve(curveOid);
                    // console.error('\x1b[33mCurve OID:', curveName, '\x1b[0m');
                    return { curve: curveName, params: {} as StandardCurve, bits: getECDSACurveBits(curveName) };
                }
                else {
                    console.log('\x1b[31malgorithmParams.idBlock.tagNumber !== 6\x1b[0m');
                }
            }
            else {
                console.error('\x1b[31mvalue block is not defined\x1b[0m');
            }
            return { curve: 'Unknown', params: {} as StandardCurve, bits: 'Unknown' };
        }
    } catch (error) {
        console.error('Error parsing EC parameters:', error);
        return { curve: 'Error', params: {} as StandardCurve, bits: 'Unknown' };
    }
}

export function parseRsaPssParams(params: any): { hashAlgorithm: string, mgf: string, saltLength: string } {
    try {
        const algorithmParams = asn1.fromBER(params.valueBeforeDecodeView);
        const sequence = algorithmParams.result;

        let hashAlgorithm = 'Unknown';
        let mgf = 'Unknown';
        let saltLength = "Unknown";

        // Parse hash algorithm
        if ((sequence.valueBlock as any).value && (sequence.valueBlock as any).value[0]) {
            const hashAlgorithmSequence = (sequence.valueBlock as any).value[0].valueBlock.value[0];
            const hashAlgorithmOid = hashAlgorithmSequence.valueBlock.value[0].valueBlock.toString();
            hashAlgorithm = getHashAlgorithmName(hashAlgorithmOid);
        }

        // Parse MGF
        if ((sequence.valueBlock as any).value && (sequence.valueBlock as any).value[1]) {
            const mgfSequence = (sequence.valueBlock as any).value[1].valueBlock.value[0];
            const mgfOid = mgfSequence.valueBlock.value[0].valueBlock.toString();
            mgf = mgfOid === '1.2.840.113549.1.1.8' ? 'MGF1' : `Unknown (${mgfOid})`;
        }
        // console.log((sequence.valueBlock as any).value[0].valueBlock);
        // console.log((sequence.valueBlock as any).value[1].valueBlock);
        // console.log((sequence.valueBlock as any).value[2].valueBlock);

        // Parse salt length
        if ((sequence.valueBlock as any).value && (sequence.valueBlock as any).value[2]) {
            const saltLengthContainer = (sequence.valueBlock as any).value[2];

            if (saltLengthContainer.valueBlock && saltLengthContainer.valueBlock.value) {
                const rawSaltLength = saltLengthContainer.valueBlock.value[0];
                if (typeof rawSaltLength === 'number') {
                    saltLength = rawSaltLength.toString();

                } else if (rawSaltLength && rawSaltLength.valueBlock && rawSaltLength.valueBlock.valueHexView) {
                    const saltLengthValue = rawSaltLength.valueBlock.valueHexView[0];
                    saltLength = saltLengthValue.toString();
                } else {
                    console.error('\x1b[31mUnable to parse salt length\x1b[0m');
                }
            } else {
                console.log("\x1b[31mSalt length not found\x1b[0m");
            }
        }

        return { hashAlgorithm, mgf, saltLength };
    } catch (error) {
        console.error('Error parsing RSA-PSS parameters:', error);
        return { hashAlgorithm: 'Unknown', mgf: 'Unknown', saltLength: "Unknown" };
    }
}

export function parseRsaPssPublicKey(subjectPublicKeyInfo: any, rsaPssParams: any): PublicKeyDetailsRSAPSS {
    let hashAlgorithm = 'Unknown';
    let mgf = 'Unknown';
    let saltLength = "Unknown";

    if (rsaPssParams) {
        const parsedParams = parseRsaPssParams(rsaPssParams);
        hashAlgorithm = parsedParams.hashAlgorithm;
        mgf = parsedParams.mgf;
        saltLength = parsedParams.saltLength;
    } else {
        console.log('\x1b[31mRSA-PSS parameters not found\x1b[0m');
    }

    // Add PublicKeyDetails for RSA-PSS
    const publicKey = subjectPublicKeyInfo.subjectPublicKey;
    const asn1PublicKey = fromBER(publicKey.valueBlock.valueHexView);
    const rsaPublicKey = asn1PublicKey.result.valueBlock;

    if (rsaPublicKey && (rsaPublicKey as any).value && (rsaPublicKey as any).value[0] && (rsaPublicKey as any).value[1]) {
        const modulusAsn1 = (rsaPublicKey as any).value[0];
        const exponentAsn1 = (rsaPublicKey as any).value[1];
        const modulusHex = Buffer.from(modulusAsn1.valueBlock.valueHexView).toString('hex');
        const exponentHex = Buffer.from(exponentAsn1.valueBlock.valueHexView).toString('hex');

        const publicKeyForge = forge.pki.rsa.setPublicKey(
            new forge.jsbn.BigInteger(modulusHex, 16),
            new forge.jsbn.BigInteger(exponentHex, 16)
        );
        const PublicKeyDetailsRSAPSS: PublicKeyDetailsRSAPSS = {
            modulus: publicKeyForge.n.toString(16),
            exponent: publicKeyForge.e.toString(10),
            bits: publicKeyForge.n.bitLength().toString(),
            hashAlgorithm,
            mgf,
            saltLength
        };
        return PublicKeyDetailsRSAPSS;
    }
    else {
        return null;
    }
}
