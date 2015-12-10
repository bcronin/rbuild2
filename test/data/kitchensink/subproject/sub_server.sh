#!/bin/bash

SERVER_ID=$(( ( RANDOM % 1000 )  + 1 ))
echo =-=-=-=-=-=-=-=-=-=-=-=-=
echo Starting sub-server $SERVER_ID
echo =-=-=-=-=-=-=-=-=-=-=-=-=
echo
for i in `seq 1 1000`;
do
    echo "sub-server loop $i ($SERVER_ID)"
    sleep 3
done
