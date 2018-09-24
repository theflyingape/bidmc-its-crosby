#!/bin/sh

cd "`dirname $0`"
DIR="`pwd`/static/dir"
TS="`date +'%Y%m%d-%H'`"

FILE="${DIR}/data/bidmc-cros-${TS}.json"
curl --noproxy '*' -k https://localhost:3333/crosby/devices -o "${FILE}" &> /dev/null
[ -f "${FILE}" ] || exit 1

[ -s "${DIR}/data/latest.json" ] && rm -f "${DIR}/data/latest.json"
ln -s "${FILE}" "${DIR}/data/latest.json"

CSV="${DIR}/data/bidmc-cros-${TS}.csv"
XLSX="${DIR}/sheets/report-${TS}.xlsx"
node render "${FILE}" "${XLSX}"

[ -s "${DIR}/data/latest.csv" ] && rm -f "${DIR}/data/latest.csv"
ln -s "${CSV}" "${DIR}/data/latest.csv"
[ -s "${DIR}/sheets/latest.xlsx" ] && rm -f "${DIR}/sheets/latest.xlsx"
ln -s "${XLSX}" "${DIR}/sheets/latest.xlsx"

# keep last 3-weeks
find "${DIR}/data" -name '*.json' -mtime +20 -exec rm -f {} \;
find "${DIR}/data" -name '*.csv' -mtime +20 -exec rm -f {} \;
find "${DIR}/sheets" -name '*.xlsx' -mtime +20 -exec rm -f {} \;
