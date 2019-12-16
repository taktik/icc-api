import { Moment } from "moment"
export declare function isValidIBAN(iban: string): boolean
export declare function ibanValidate(iban: string): boolean
export declare function ibanFormat(iban: string): string
export declare function nihiiFormat(nihii: string): string
export declare function nihiiValidate(nihii: string): boolean
export declare function ssinFormat(ssin: string): string
export declare function ssinValidate(ssin: string): boolean
export declare function phoneNumberValidate(phoneNumber: string): boolean
export declare function phoneNumberFormat(phoneNumber: string): string
/**
 * Converts a backend date number (e.g., patient birth date) into a Date object.
 * @param dateNumber a YYYYMMDD date number from the backend
 * @return a Date object
 * @throws Error if it is impossible to create a date from the number, other if dateNumber is negative.
 * @see #dateEncode
 * @see #timeDecode
 */
export declare function dateDecode(dateNumber: number): Date | undefined
/**
 * Converts a backend time number (e.g., health element openingDate) into a Date object.
 * @param timeNumber a YYYYMMDD date number from the backend
 * @return a Date object
 * @see #timeEncode
 * @see #dateDecode
 */
export declare function timeDecode(timeNumber: number): Date | undefined
/**
 * Encodes a Date object into a backend date number (e.g., patient birth date).
 * @param date a Date object
 * @return a YYYYMMDD date number for the backend
 * @see #dateDecode
 * @see #timeEncode
 */
export declare function dateEncode(date: Date): number | undefined
/**
 * Encodes a Date object into a backend time number (e.g., health element openingDate).
 * @param date a Date object
 * @return a YYYYMMDDHHmmss date number for the backend
 * @see #timeDecode
 * @see #dateEncode
 */
export declare function timeEncode(date: Date): number | undefined
/**
 * Formats a value and a physical unit into text.
 * @param value the numerical or string value to encode
 * @param unit the unit represented as a string (an empty string is also supported)
 */
export declare function unit(value: number | string, unit: string | null): string
/**
 * 0.1 + 0.2 = 0.30000000000000004. Use this function to be better at maths.
 * @param a number
 * @return the rounded number, two after the comma
 */
export declare function amount(value: number): number
/**
 * A simple formatter to keep the logic across the app.
 * Input: 2.1 ; Output: 2.10€
 */
export declare function money(value: number): string
/**
 * Transform a dictionary to a url params.
 * From { key1: value1, key2: value2, ... } returns key1=value1&key2=value2&...=...
 */
export declare function toUrlParams(params: { [key: string]: string }): string
export declare function personName(person: { firstName?: string; lastName?: string }): string
export declare function personNameAbbrev(person: { firstName?: string; lastName?: string }): string
export declare function toMoment(epochOrLongCalendar: number): Moment | null
