import { parseNumber, formatNumber, isValidNumber } from "libphonenumber-js"

import * as moment from "moment"
import * as _ from "lodash"
import { Moment } from "moment"

// TODO: move this to env.js?
const DEFAULT_COUNTRY = "BE"

const nihiiRegExp = new RegExp("^(\\d{1})(\\d{5})(\\d{2})(\\d{3})$")
const ssinRegExp = new RegExp("^(\\d{2})(\\d{2})(\\d{2})(\\d{3})(\\d{2})$")
const ibanRegExp = new RegExp("^(\\d{4})(\\d{4})(\\d{4})(\\d{4})$")

const patterns = {
  IBAN: (iban: string) => /^BE\d{14}$/.test(iban) && isValidIBAN(iban),
  IBANBE: (iban: string) => /^BE\d{14}$/.test(iban) && isValidIBAN(iban)
}

//http://ht5ifv.serprest.pt/extensions/tools/IBAN/
export function isValidIBAN(iban: string) {
  //This function check if the checksum if correct
  iban = iban.replace(/^(.{4})(.*)$/, "$2$1") //Move the first 4 chars from left to the right
  const fun = (e: string) => (e.charCodeAt(0) - "A".charCodeAt(0) + 10).toString()
  iban = iban.replace(/[A-Z]/g, fun) //Convert A-Z to 10-25
  let $sum = 0
  let $ei = 1 //First exponent
  for (let $i = iban.length - 1; $i >= 0; $i--) {
    $sum += $ei * parseInt(iban.charAt($i), 10) //multiply the digit by it's exponent
    $ei = ($ei * 10) % 97 //compute next base 10 exponent  in modulus 97
  }
  return $sum % 97 === 1
}

export function ibanValidate(iban: string) {
  if (iban.startsWith("BE")) {
    return patterns.IBANBE(iban)
  } else {
    return patterns.IBAN(iban)
  }
}

export function ibanFormat(iban: string): string {
  return iban.replace(ibanRegExp, "$1 $2 $3 $4")
}

export function nihiiFormat(nihii: string): string {
  return nihii.replace(nihiiRegExp, "$1 $2 $3 $4")
}

export function nihiiValidate(nihii: string): boolean {
  return !!nihii.match(nihiiRegExp)
}

export function ssinFormat(ssin: string): string {
  return ssin.replace(ssinRegExp, "$1 $2 $3 $4 $5")
}

export function ssinValidate(ssin: string): boolean {
  return !!ssin.match(ssinRegExp)
}

export function phoneNumberValidate(phoneNumber: string): boolean {
  return isValidNumber(phoneNumber)
}

export function phoneNumberFormat(phoneNumber: string): string {
  const parsedPhoneNumber = parseNumber(phoneNumber, DEFAULT_COUNTRY)
  if (_.isEmpty(parsedPhoneNumber)) {
    // The number is not valid, so we leave the input string as-is.
    return phoneNumber
  }
  return formatNumber(parsedPhoneNumber, "International")
}

/**
 * Converts a backend date number (e.g., patient birth date) into a Date object.
 * @param dateNumber a YYYYMMDD date number from the backend
 * @return a Date object
 * @throws Error if it is impossible to create a date from the number, other if dateNumber is negative.
 * @see #dateEncode
 * @see #timeDecode
 */
export function dateDecode(dateNumber: number): Date | undefined {
  if (!dateNumber) {
    return undefined
  }

  if (dateNumber < 0) {
    throw new Error("We don't decode negative dates. Please make sure you have valid data.")
  }
  const dateNumberStr: string = _.padStart(dateNumber.toString(), 8, "19700101")
  if (dateNumberStr.length > 8) {
    if (dateNumberStr.endsWith("000000")) {
      return dateNumber ? moment(dateNumberStr, "YYYYMMDD000000").toDate() : undefined
    }

    throw Error("Decoded date is over year 9999. We can't format it properly.")
  }
  return dateNumber ? moment(dateNumberStr, "YYYYMMDD").toDate() : undefined
}

/**
 * Converts a backend time number (e.g., health element openingDate) into a Date object.
 * @param timeNumber a YYYYMMDD date number from the backend
 * @return a Date object
 * @see #timeEncode
 * @see #dateDecode
 */
export function timeDecode(timeNumber: number): Date | undefined {
  return timeNumber ? moment(timeNumber.toString(), "YYYYMMDDHHmmss").toDate() : undefined
}

/**
 * Encodes a Date object into a backend date number (e.g., patient birth date).
 * @param date a Date object
 * @return a YYYYMMDD date number for the backend
 * @see #dateDecode
 * @see #timeEncode
 */
export function dateEncode(date: Date): number | undefined {
  const dateStr = _.padStart(moment(date).format("YYYYMMDD"), 8, "19700101")
  // date is null if the field is not set
  return date ? Number(dateStr) : undefined
}

/**
 * Encodes a Date object into a backend time number (e.g., health element openingDate).
 * @param date a Date object
 * @return a YYYYMMDDHHmmss date number for the backend
 * @see #timeDecode
 * @see #dateEncode
 */
export function timeEncode(date: Date): number | undefined {
  return date ? Number(moment(date).format("YYYYMMDDHHmmss")) : undefined
}

/**
 * Formats a value and a physical unit into text.
 * @param value the numerical or string value to encode
 * @param unit the unit represented as a string (an empty string is also supported)
 */
export function unit(value: number | string, unit: string | null): string {
  unit = unit || ""
  let separator: string
  if (!unit || unit.startsWith("°")) {
    separator = ""
  } else {
    // including '%'
    separator = "\xa0"
  }
  return value + separator + unit
}

/**
 * 0.1 + 0.2 = 0.30000000000000004. Use this function to be better at maths.
 * @param a number
 * @return the rounded number, two after the comma
 */
export function amount(value: number): number {
  return Number((value || 0).toFixed(2))
}

/**
 * A simple formatter to keep the logic across the app.
 * Input: 2.1 ; Output: 2.10€
 */
export function money(value: number): string {
  return [(value || 0).toFixed(2), "€"].join("")
}

/**
 * Transform a dictionary to a url params.
 * From { key1: value1, key2: value2, ... } returns key1=value1&key2=value2&...=...
 */
export function toUrlParams(params: { [key: string]: string }): string {
  return _.filter(_.map(params, (value, key) => (value ? key + "=" + value : undefined))).join("&")
}

export function personName(person: { firstName?: string; lastName?: string }): string {
  return `${person.firstName || ""} ${person.lastName || ""}`.trim()
}

export function personNameAbbrev(person: { firstName?: string; lastName?: string }): string {
  const firstName = person.firstName ? person.firstName[0] + "." : undefined
  return personName({ ...person, firstName })
}

export function toMoment(epochOrLongCalendar: number): Moment | null {
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
