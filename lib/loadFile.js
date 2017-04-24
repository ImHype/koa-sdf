const mime = require("mime-types");
const crypto = require("crypto");
const debug = require("debug")("koa-static-cache");
const fs = require("mz/fs");
const path = require("path");

/**
 * load file and add file content to cache
 *
 * @param {String} name
 * @param {String} dir
 * @param {Object} options
 * @return {Object}
 * @api private
 */
function loadFile(name, dir, options) {
  var pathname = path.normalize(path.join(options.prefix, name));
  var obj = {};
  var filename = (obj.path = path.join(dir, name));
  var stats = fs.statSync(filename);
  var buffer = fs.readFileSync(filename);

  obj.cacheControl = options.cacheControl;
  obj.maxAge = obj.maxAge ? obj.maxAge : options.maxAge || 0;
  obj.type = obj.mime = mime.lookup(pathname) || "application/octet-stream";
  obj.mtime = stats.mtime;
  obj.length = stats.size;
  obj.md5 = crypto.createHash("md5").update(buffer).digest("base64");

  debug("file: " + JSON.stringify(obj, null, 2));
  if (options.buffer) obj.buffer = buffer;

  buffer = null;
  return obj;
}

module.exports = loadFile;
