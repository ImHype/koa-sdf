const crypto = require('crypto')
const fs = require('mz/fs')
const path = require('path')
const mime = require('mime-types')
const debug = require('debug')('koa-static-cache')

module.exports = function (dir, options, files) {
  if (typeof dir === 'object') {
    options = dir
    dir = null
  }

  options = Object.assign({}, options) || {}
  // prefix must be ASCII code
  options.prefix = (options.prefix || '').replace(/\/*$/, '/')
  dir = dir || options.dir || process.cwd()
  const filePrefix = path.normalize(options.prefix.replace(/^\//, ''))

  // option.filter
  let fileFilter = function () { return true }
  if (Array.isArray(options.filter)) fileFilter = function (file) { return ~options.filter.indexOf(file) }
  if (typeof options.filter === 'function') fileFilter = options.filter


  return function* koaSendFile(next) {
    // only accept HEAD and GET
    if (this.method !== 'HEAD' && this.method !== 'GET') {
        return yield next
    }
    // check prefix first to avoid calculate
    if (this.path.indexOf(options.prefix) !== 0) {
        return yield next
    }

    // decode for `/%E4%B8%AD%E6%96%87`
    // normalize for `//index`
    let filename = safeDecodeURIComponent(path.normalize(this.path))

    // try to load file
    if (filename.charAt(0) === path.sep) {
        filename = filename.slice(1)
    }

    // trim prefix
    if (options.prefix !== '/') {
        if (filename.indexOf(filePrefix) !== 0) {
            return yield next
        }
        filename = filename.slice(filePrefix.length)
    }

    if (!isFileExsit(path.join(dir, filename))) {
        return yield next
    }


    if (this.method === 'HEAD') {
        return yield next
    }
        
     
    let file = loadFile(filename, dir, options)
    
    this.status = 200

    if (!file.buffer) {
      var stats = yield fs.stat(file.path)
      if (stats.mtime > file.mtime) {
        file.mtime = stats.mtime
        file.md5 = null
        file.length = stats.size
      }
    }

    this.response.lastModified = file.mtime
    
    if (file.md5) {
        this.response.etag = file.md5
        this.set('content-md5', file.md5)
    }

    this.type = file.type
    this.length = file.zipBuffer ? file.zipBuffer.length : file.length
    this.set('cache-control', 'public, max-age=' + file.maxAge)

    if (file.buffer) {
      return this.body = file.buffer
    }

    var stream = fs.createReadStream(file.path)

    // update file hash
    this.body = stream
  }
}

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

function safeDecodeURIComponent(text) {
  try {
    return decodeURIComponent(text)
  } catch (e) {
    return text
  }
}

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
  var pathname = path.normalize(path.join(options.prefix, name))
  var obj = {}
  var filename = obj.path = path.join(dir, name)
  var stats = fs.statSync(filename)
  var buffer = fs.readFileSync(filename)

  obj.cacheControl = options.cacheControl
  obj.maxAge = obj.maxAge ? obj.maxAge : options.maxAge || 0
  obj.type = obj.mime = mime.lookup(pathname) || 'application/octet-stream'
  obj.mtime = stats.mtime
  obj.length = stats.size
  obj.md5 = crypto.createHash('md5').update(buffer).digest('base64')

  debug('file: ' + JSON.stringify(obj, null, 2))
  if (options.buffer)
    obj.buffer = buffer

  buffer = null
  return obj
}
