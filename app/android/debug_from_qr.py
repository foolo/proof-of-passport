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


TYPE = "_adb-tls-pairing._tcp.local."
NAME = "debug"
PASS = "123456"

CMD_PAIR = "adb pair %s:%s %s"
CMD_DEVICES = "adb devices -l"

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
        cmd = CMD_PAIR % (info.server, info.port, PASS)
        print(cmd)
        subprocess.run(cmd, shell=True)


def main():
    text = f"WIFI:T:ADB;S:{NAME};P:{PASS};;"
    subprocess.run(["qrencode", "--type", "UTF8", text])

    print("Scan QR code to pair new devices.")
    print("[Developer options]-[Wireless debugging]-[Pair device with QR code]")

    zc = Zeroconf()
    listener = MyListener()
    _browser = ServiceBrowser(zc, TYPE, listener)

    try:
        input("Press enter to exit...\n\n")
    finally:
        zc.close()
        subprocess.run(CMD_DEVICES, shell=True)


if __name__ == '__main__':
    main()
    