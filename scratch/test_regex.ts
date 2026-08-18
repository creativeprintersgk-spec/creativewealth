const err = "Could not find the 'extid' column of 'acmac1' in the schema cache";
const match = err.match(/Could not find the ['"]?(.*?)['"]? column/i);
console.log("MATCH 1:", match && match[1]);

const err2 = "Could not find the 'parent_extid' column of 'acmac1'";
const match2 = err2.match(/Could not find the ['"]?(.*?)['"]? column/i);
console.log("MATCH 2:", match2 && match2[1]);
