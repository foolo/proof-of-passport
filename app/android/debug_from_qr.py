#!/usr/bin/env python3

# https://gist.github.com/benigumocom/a6a87fc1cb690c3c4e3a7642ebf2be6f
"""
Android11
Pair and connect devices for wireless debug on terminal

python-zeroconf: A pure python implementation of multicast DNS service discovery
https://github.com/jstasiak/python-zeroconf
"""

import subprocess
from zeroconf import ServiceBrowser, ServiceInfo, ServiceListener, Zeroconf

NAME = "debug"
PAIRING_CODE = "123456"


class MyListener(ServiceListener):

    def remove_service(self, zc: Zeroconf, type_: str, name: str):
        print("Service %s removed." % name)
        print("Press enter to exit...\n")

    def add_service(self, zc: Zeroconf, type_: str, name: str):
        info = zc.get_service_info(type_, name)
        if info is None:
            print("get_service_info failed")
            return
        print("Service %s added." % name)
        print("service info: %s\n" % info)
        self.pair(info)

    def pair(self, info: ServiceInfo):
        cmd = ["adb", "pair", f"{info.server}:{info.port}", PAIRING_CODE]
        subprocess.run(cmd, shell=True)


def main():
    text = f"WIFI:T:ADB;S:{NAME};P:{PAIRING_CODE};;"
    subprocess.run(["qrencode", "--type", "UTF8", text])

    print("Scan QR code to pair new devices.")
    print("[Developer options]-[Wireless debugging]-[Pair device with QR code]")

    zc = Zeroconf()
    listener = MyListener()
    service_type = "_adb-tls-pairing._tcp.local."
    _browser = ServiceBrowser(zc, service_type, listener)

    try:
        input("Press enter to exit...\n\n")
    finally:
        zc.close()
        subprocess.run("adb devices -l", shell=True)


if __name__ == '__main__':
    main()
