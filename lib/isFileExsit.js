const fs = require('mz/fs')

function isFileExsit(filename) {
    var s
    try {
        s = fs.statSync(filename)
    } catch (err) {
        return false
    }

    if (!s.isFile()) {
        return false
    }

    return true
}

module.exports = isFileExsit;
