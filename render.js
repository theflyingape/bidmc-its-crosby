"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*****************************************************************************\
 *  render: Google dataset + template -> Open Document writer                *
 *  authored by: Robert Hurst <rhurst@bidmc.harvard.edu>                     *
\*****************************************************************************/
const fs = require("fs");
const path = require("path");
const carbone = require("carbone");
const csvjs = require("csvjson");
//  pass-in cli arguments
let rest = process.argv.splice(2);
let inFile = rest.shift();
let outFile = rest.shift();
//  parse input file to determine which output template to use
let form = path.basename(outFile).split('-')[0];
let template = path.dirname(outFile) + `/${form}.xlsx`;
//  data file becomes a new document
let data = fs.readFileSync(inFile, { encoding: 'utf8' });
if (inFile.split('.')[1] == 'json') {
    let json = JSON.parse(data).sort((n1, n2) => {
        return n1.orgUnitPath < n2.orgUnitPath ? -1
            : n1.orgUnitPath > n2.orgUnitPath ? 1
                : n1.annotatedAssetId < n2.annotatedAssetId ? -1
                    : n1.annotatedAssetId > n2.annotatedAssetId ? 1
                        : 0;
    });
    data = `orgUnitPath\tannotatedAssetId\tserialNumber\tstatus\tlastEnrollmentTime\tlastSync\tsupportEndDate\tannotatedUser\tannotatedLocation\n`;
    for (var i in json) {
        json[i].annotatedLocation = json[i].annotatedLocation || '';
        json[i].lastEnrollmentTime = new Date(json[i].lastEnrollmentTime).toLocaleString().replace(',', '');
        json[i].lastSync = new Date(json[i].lastSync).toLocaleString().replace(',', '');
        json[i].supportEndDate = json[i].supportEndDate || '';
        data += `${json[i].orgUnitPath}\t${json[i].annotatedAssetId}\t${json[i].serialNumber}\t${json[i].status}\t${json[i].lastEnrollmentTime}\t${json[i].lastSync}\t${json[i].supportEndDate}\t${json[i].annotatedUser}\t${json[i].annotatedLocation}\n`;
    }
}
let columns = {
    created: Date().toString().split(' ').splice(0, 4).join(' '),
    data: []
};
//columns.data = csvjs.toColumnArray(data, { delimiter: '\t' })
//console.log(columns)
columns.data = csvjs.toObject(data, { delimiter: '\t' });
fs.writeFileSync(inFile.split('.')[0] + '.csv', data);
carbone.render(template, columns, function (err, result) {
    if (err) {
        return console.log(err);
    }
    fs.writeFileSync(outFile, result);
});
//# sourceMappingURL=render.js.map