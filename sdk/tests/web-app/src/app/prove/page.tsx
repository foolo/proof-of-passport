'use client';

import OpenPassportQRcode from '../../../../../qrcode/OpenPassportQRcode';
import { v4 as uuidv4 } from 'uuid';
import { OpenPassportVerifier, OpenPassportDynamicAttestation } from '@openpassport/core';
export default function Prove() {
  const userId = uuidv4();
  const scope = 'scope';

  const openPassportVerifier: OpenPassportVerifier = new OpenPassportVerifier('prove_offchain', scope)
    .discloseNationality()
    .allowMockPassports();
  return (
    <div className="h-screen w-full bg-white flex flex-col items-center justify-center gap-4">
      <OpenPassportQRcode
        appName="Mock App"
        userId={userId}
        userIdType={'uuid'}
        openPassportVerifier={openPassportVerifier}
        onSuccess={(attestation) => {
          const dynamicAttestation = new OpenPassportDynamicAttestation(attestation);
          console.log('nationality:', dynamicAttestation.getNationality());
          // send the code to the backend server
        }}
      />
    </div>
  );
}
