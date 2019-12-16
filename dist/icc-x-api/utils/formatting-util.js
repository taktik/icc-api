"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
const libphonenumber_js_1 = require("libphonenumber-js")
const moment = require("moment")
const _ = require("lodash")
// TODO: move this to env.js?
const DEFAULT_COUNTRY = "BE"
const nihiiRegExp = new RegExp("^(\\d{1})(\\d{5})(\\d{2})(\\d{3})$")
const ssinRegExp = new RegExp("^(\\d{2})(\\d{2})(\\d{2})(\\d{3})(\\d{2})$")
const ibanRegExp = new RegExp("^(\\d{4})(\\d{4})(\\d{4})(\\d{4})$")
const patterns = {
  IBAN: iban => /^BE\d{14}$/.test(iban) && isValidIBAN(iban),
  IBANBE: iban => /^BE\d{14}$/.test(iban) && isValidIBAN(iban)
}
//http://ht5ifv.serprest.pt/extensions/tools/IBAN/
function isValidIBAN(iban) {
  //This function check if the checksum if correct
  iban = iban.replace(/^(.{4})(.*)$/, "$2$1") //Move the first 4 chars from left to the right
  const fun = e => (e.charCodeAt(0) - "A".charCodeAt(0) + 10).toString()
  iban = iban.replace(/[A-Z]/g, fun) //Convert A-Z to 10-25
  let $sum = 0
  let $ei = 1 //First exponent
  for (let $i = iban.length - 1; $i >= 0; $i--) {
    $sum += $ei * parseInt(iban.charAt($i), 10) //multiply the digit by it's exponent
    $ei = ($ei * 10) % 97 //compute next base 10 exponent  in modulus 97
  }
  return $sum % 97 === 1
}
exports.isValidIBAN = isValidIBAN
function ibanValidate(iban) {
  if (iban.startsWith("BE")) {
    return patterns.IBANBE(iban)
  } else {
    return patterns.IBAN(iban)
  }
}
exports.ibanValidate = ibanValidate
function ibanFormat(iban) {
  return iban.replace(ibanRegExp, "$1 $2 $3 $4")
}
exports.ibanFormat = ibanFormat
function nihiiFormat(nihii) {
  return nihii.replace(nihiiRegExp, "$1 $2 $3 $4")
}
exports.nihiiFormat = nihiiFormat
function nihiiValidate(nihii) {
  return !!nihii.match(nihiiRegExp)
}
exports.nihiiValidate = nihiiValidate
function ssinFormat(ssin) {
  return ssin.replace(ssinRegExp, "$1 $2 $3 $4 $5")
}
exports.ssinFormat = ssinFormat
function ssinValidate(ssin) {
  return !!ssin.match(ssinRegExp)
}
exports.ssinValidate = ssinValidate
/* Alternate lib free version
export function phoneNumberValidate(phoneNumber: string): boolean {
  return (
    !!phoneNumber.match(/(?:\+|00)([1-9][0-9]{1-2})([- /.]*([0-9]+))+/) ||
    !!phoneNumber.match(/(0[1-9][0-9]*)([- /.]*([0-9]+))+/)
  )
}

export function phoneNumberFormat(phoneNumber: string): string {
  let match = phoneNumber.match(/(?:\+|00)([1-9][0-9]{1-2})([- /.]*([0-9]+))+/)
  if (match) {
    return `+${match[1]} ${match[2].replace(/[- /.]/g, " ")}`.replace(/  /g, " ")
  }
  match = phoneNumber.match(/0([1-9][0-9]*)([- /.]*([0-9]+))+/)
  if (match) {
    return `+32 ${match[1]} ${match[2].replace(/[- /.]/g, " ")}`.replace(/  /g, " ")
  }
  return phoneNumber
}
*/
function phoneNumberValidate(phoneNumber) {
  return libphonenumber_js_1.isValidNumber(phoneNumber)
}
exports.phoneNumberValidate = phoneNumberValidate
function phoneNumberFormat(phoneNumber) {
  const parsedPhoneNumber = libphonenumber_js_1.parseNumber(phoneNumber, DEFAULT_COUNTRY)
  if (_.isEmpty(parsedPhoneNumber)) {
    // The number is not valid, so we leave the input string as-is.
    return phoneNumber
  }
  return libphonenumber_js_1.formatNumber(parsedPhoneNumber, "International")
}
exports.phoneNumberFormat = phoneNumberFormat
/**
 * Converts a backend date number (e.g., patient birth date) into a Date object.
 * @param dateNumber a YYYYMMDD date number from the backend
 * @return a Date object
 * @throws Error if it is impossible to create a date from the number, other if dateNumber is negative.
 * @see #dateEncode
 * @see #timeDecode
 */
function dateDecode(dateNumber) {
  if (!dateNumber) {
    return undefined
  }
  if (dateNumber < 0) {
    throw new Error("We don't decode negative dates. Please make sure you have valid data.")
  }
  const dateNumberStr = _.padStart(dateNumber.toString(), 8, "19700101")
  if (dateNumberStr.length > 8) {
    if (dateNumberStr.endsWith("000000")) {
      return dateNumber ? moment(dateNumberStr, "YYYYMMDD000000").toDate() : undefined
    }
    throw Error("Decoded date is over year 9999. We can't format it properly.")
  }
  return dateNumber ? moment(dateNumberStr, "YYYYMMDD").toDate() : undefined
}
exports.dateDecode = dateDecode
/**
 * Converts a backend time number (e.g., health element openingDate) into a Date object.
 * @param timeNumber a YYYYMMDD date number from the backend
 * @return a Date object
 * @see #timeEncode
 * @see #dateDecode
 */
function timeDecode(timeNumber) {
  return timeNumber ? moment(timeNumber.toString(), "YYYYMMDDHHmmss").toDate() : undefined
}
exports.timeDecode = timeDecode
/**
 * Encodes a Date object into a backend date number (e.g., patient birth date).
 * @param date a Date object
 * @return a YYYYMMDD date number for the backend
 * @see #dateDecode
 * @see #timeEncode
 */
function dateEncode(date) {
  const dateStr = _.padStart(moment(date).format("YYYYMMDD"), 8, "19700101")
  // date is null if the field is not set
  return date ? Number(dateStr) : undefined
}
exports.dateEncode = dateEncode
/**
 * Encodes a Date object into a backend time number (e.g., health element openingDate).
 * @param date a Date object
 * @return a YYYYMMDDHHmmss date number for the backend
 * @see #timeDecode
 * @see #dateEncode
 */
function timeEncode(date) {
  return date ? Number(moment(date).format("YYYYMMDDHHmmss")) : undefined
}
exports.timeEncode = timeEncode
/**
 * Formats a value and a physical unit into text.
 * @param value the numerical or string value to encode
 * @param unit the unit represented as a string (an empty string is also supported)
 */
function unit(value, unit) {
  unit = unit || ""
  let separator
  if (!unit || unit.startsWith("°")) {
    separator = ""
  } else {
    // including '%'
    separator = "\xa0"
  }
  return value + separator + unit
}
exports.unit = unit
/**
 * 0.1 + 0.2 = 0.30000000000000004. Use this function to be better at maths.
 * @param a number
 * @return the rounded number, two after the comma
 */
function amount(value) {
  return Number((value || 0).toFixed(2))
}
exports.amount = amount
/**
 * A simple formatter to keep the logic across the app.
 * Input: 2.1 ; Output: 2.10€
 */
function money(value) {
  return [(value || 0).toFixed(2), "€"].join("")
}
exports.money = money
/**
 * Transform a dictionary to a url params.
 * From { key1: value1, key2: value2, ... } returns key1=value1&key2=value2&...=...
 */
function toUrlParams(params) {
  return _.filter(_.map(params, (value, key) => (value ? key + "=" + value : undefined))).join("&")
}
exports.toUrlParams = toUrlParams
function personName(person) {
  return `${person.firstName || ""} ${person.lastName || ""}`.trim()
}
exports.personName = personName
function personNameAbbrev(person) {
  const firstName = person.firstName ? person.firstName[0] + "." : undefined
  return personName(Object.assign({}, person, { firstName }))
}
exports.personNameAbbrev = personNameAbbrev
function toMoment(epochOrLongCalendar) {
  if (!epochOrLongCalendar && epochOrLongCalendar !== 0) {
    return null
  }
  if (epochOrLongCalendar >= 18000101 && epochOrLongCalendar < 25400000) {
    return moment("" + epochOrLongCalendar, "YYYYMMDD")
  } else if (epochOrLongCalendar >= 18000101000000) {
    return moment("" + epochOrLongCalendar, "YYYYMMDDhhmmss")
  } else {
    return moment(epochOrLongCalendar)
  }
}
exports.toMoment = toMoment
//# sourceMappingURL=formatting-util.js.map
