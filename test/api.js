"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
var icc_x_api_1 = require("../icc-x-api")
var iccApi_1 = require("../icc-api/iccApi")
var WebCrypto = require("node-webcrypto-ossl")
var Api = /** @class */ (function() {
  function Api(host, headers, fetchImpl) {
    var _this = this
    this._currentUser = null
    this._entityreficc = new iccApi_1.iccEntityrefApi(host, headers, fetchImpl)
    this._usericc = new icc_x_api_1.IccUserXApi(host, headers, fetchImpl)
    this._hcpartyicc = new icc_x_api_1.IccHcpartyXApi(host, headers, fetchImpl)
    this._cryptoicc = new icc_x_api_1.IccCryptoXApi(
      host,
      headers,
      this._hcpartyicc,
      new iccApi_1.iccPatientApi(host, headers, fetchImpl),
      new WebCrypto()
    )
    this._contacticc = new icc_x_api_1.IccContactXApi(host, headers, this._cryptoicc, fetchImpl)
    this._formicc = new icc_x_api_1.IccFormXApi(host, headers, this._cryptoicc, fetchImpl)
    this._invoiceicc = new icc_x_api_1.IccInvoiceXApi(
      host,
      headers,
      this._cryptoicc,
      this._entityreficc,
      fetchImpl
    )
    this._documenticc = new icc_x_api_1.IccDocumentXApi(host, headers, this._cryptoicc, fetchImpl)
    this._helementicc = new icc_x_api_1.IccHelementXApi(host, headers, this._cryptoicc, fetchImpl)
    this._classificationicc = new icc_x_api_1.IccClassificationXApi(
      host,
      headers,
      this._cryptoicc,
      fetchImpl
    )
    this._bekmehricc = new iccApi_1.iccBeKmehrApi(host, headers, fetchImpl)
    this._patienticc = new icc_x_api_1.IccPatientXApi(
      host,
      headers,
      this._cryptoicc,
      this._contacticc,
      this._formicc,
      this._helementicc,
      this._invoiceicc,
      this._documenticc,
      this._hcpartyicc,
      this._classificationicc,
      ["note"],
      fetchImpl
    )
    this._usericc.getCurrentUser().then(function(u) {
      return (_this._currentUser = u)
    })
  }
  Object.defineProperty(Api.prototype, "hcpartyicc", {
    get: function() {
      return this._hcpartyicc
    },
    enumerable: true,
    configurable: true
  })
  Object.defineProperty(Api.prototype, "patienticc", {
    get: function() {
      return this._patienticc
    },
    enumerable: true,
    configurable: true
  })
  Object.defineProperty(Api.prototype, "cryptoicc", {
    get: function() {
      return this._cryptoicc
    },
    enumerable: true,
    configurable: true
  })
  Object.defineProperty(Api.prototype, "contacticc", {
    get: function() {
      return this._contacticc
    },
    enumerable: true,
    configurable: true
  })
  Object.defineProperty(Api.prototype, "formicc", {
    get: function() {
      return this._formicc
    },
    enumerable: true,
    configurable: true
  })
  Object.defineProperty(Api.prototype, "helementicc", {
    get: function() {
      return this._helementicc
    },
    enumerable: true,
    configurable: true
  })
  Object.defineProperty(Api.prototype, "usericc", {
    get: function() {
      return this._usericc
    },
    enumerable: true,
    configurable: true
  })
  Object.defineProperty(Api.prototype, "invoiceicc", {
    get: function() {
      return this._invoiceicc
    },
    enumerable: true,
    configurable: true
  })
  Object.defineProperty(Api.prototype, "documenticc", {
    get: function() {
      return this._documenticc
    },
    enumerable: true,
    configurable: true
  })
  Object.defineProperty(Api.prototype, "bekmehricc", {
    get: function() {
      return this._bekmehricc
    },
    enumerable: true,
    configurable: true
  })
  Object.defineProperty(Api.prototype, "classificationicc", {
    get: function() {
      return this._classificationicc
    },
    enumerable: true,
    configurable: true
  })
  Object.defineProperty(Api.prototype, "entityreficc", {
    get: function() {
      return this._entityreficc
    },
    enumerable: true,
    configurable: true
  })
  Object.defineProperty(Api.prototype, "currentUser", {
    get: function() {
      return this._currentUser
    },
    enumerable: true,
    configurable: true
  })
  return Api
})()
exports.Api = Api
