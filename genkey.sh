#!/bin/sh

if [ ! -d keys ]; then
        mkdir keys
        sudo chown root.sshd keys
        sudo chmod 2750 keys
        sudo openssl req -nodes -newkey rsa:2048 -sha256 -keyout "keys/localhost.key" -x509 -days 1075 -out "keys/localhost.crt" -subj "/C=US/ST=Massachusetts/L=Boston/O=Beth Israel Deaconess Medical Center Inc/OU=IS/CN=localhost"
fi
