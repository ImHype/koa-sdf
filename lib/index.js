const fs = require('mz/fs');
const path = require('path');
const isFileExsit = require('./isFileExsit');
const loadFile = require('./loadFile');
const format = require('./format');
const safeDecodeURIComponent = require('./safeDecodeURIComponent');

module.exports = function(dir, options) {
    if (!options) {
        options = format(dir);
        dir = null
    }
    
    options = Object.assign({}, options)
    // prefix must be ASCII code
    options.prefix = (options.prefix || '').replace(/\/*$/, '/');
    dir = dir || options.dir || process.cwd();
    const filePrefix = path.normalize(options.prefix.replace(/^\//, ''));

    // option.filter
    let fileFilter = function() {
        return true;
    };
    if (Array.isArray(options.filter))
        fileFilter = function(file) {
        return ~options.filter.indexOf(file);
        };
    if (typeof options.filter === 'function') fileFilter = options.filter;

    return function* koaSendFile(next) {
        // only accept HEAD and GET
        if (this.method !== 'HEAD' && this.method !== 'GET') {
            return yield next;
        }
        // check prefix first to avoid calculate
        if (this.path.indexOf(options.prefix) !== 0) {
            return yield next;
        }

        // decode for `/%E4%B8%AD%E6%96%87`
        // normalize for `//index`
        let filename = safeDecodeURIComponent(path.normalize(this.path));

        // try to load file
        if (filename.charAt(0) === path.sep) {
            filename = filename.slice(1);
        }

        // trim prefix
        if (options.prefix !== '/') {
            if (filename.indexOf(filePrefix) !== 0) {
                return yield next;
            }
            filename = filename.slice(filePrefix.length);
        }

        if (!isFileExsit(path.join(dir, filename))) {
            return yield next;
        }

        if (this.method === 'HEAD') {
            return yield next;
        }

        let file = loadFile(filename, dir, options);

        this.status = 200;

        if (!file.buffer) {
            var stats = yield fs.stat(file.path);
            if (stats.mtime > file.mtime) {
                file.mtime = stats.mtime;
                file.md5 = null;
                file.length = stats.size;
            }
        }

        this.response.lastModified = file.mtime;

        if (file.md5) {
            this.response.etag = file.md5;
            this.set('content-md5', file.md5);
        }

        this.type = file.type;
        this.length = file.zipBuffer ? file.zipBuffer.length : file.length;
        this.set('cache-control', 'public, max-age=' + file.maxAge);

        if (file.buffer) {
            return (this.body = file.buffer);
        }

        var stream = fs.createReadStream(file.path);

        // update file hash
        this.body = stream;
    };
};
