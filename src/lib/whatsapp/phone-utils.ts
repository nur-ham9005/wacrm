/**
 * Sanitize phone number for Meta WhatsApp API.
 * Meta requires digits only — no + prefix, no spaces, no dashes.
 * e.g. "+370 63949836" → "37063949836"
 */
export function sanitizePhoneForMeta(phone: string): string {
  if (!phone) return ''
  return phone.replace(/\D/g, '')
}

/**
 * Normalize phone number by removing all non-digit characters.
 * Used for comparing phone numbers in different formats.
 */
export function normalizePhone(phone: string): string {
  if (!phone) return ''
  return phone.replace(/\D/g, '')
}

/**
 * Compare two phone numbers accounting for trunk prefix differences.
 * e.g. "370063949836" (with trunk 0) matches "37063949836" (without trunk 0)
 * by comparing the last 8 digits.
 */
export function phonesMatch(phone1: string, phone2: string): boolean {
  const n1 = normalizePhone(phone1)
  const n2 = normalizePhone(phone2)
  if (n1 === n2) return true
  if (n1.length >= 8 && n2.length >= 8) {
    return n1.slice(-8) === n2.slice(-8)
  }
  return false
}

/**
 * Validate phone number is E.164-like format (7-15 digits starting with non-zero).
 * Accepts with or without + prefix.
 */
export function isValidE164(phone: string): boolean {
  return /^\+?[1-9]\d{6,14}$/.test(phone)
}

/**
 * ITU country calling codes (1–3 digits). `countryCodeFromE164` uses
 * this to tell where a business number's country code ends — e.g. for
 * "6281234567890" only "62" is a real code (Indonesia), never "6" or
 * "628", so the derivation is unambiguous.
 */
export const COUNTRY_CODES: ReadonlySet<string> = new Set([
  // 1-digit
  '1', '7',
  // 2-digit
  '20', '27', '30', '31', '32', '33', '34', '36', '39',
  '40', '41', '43', '44', '45', '46', '47', '48', '49',
  '51', '52', '53', '54', '55', '56', '57', '58',
  '60', '61', '62', '63', '64', '65', '66',
  '81', '82', '84', '86', '90', '91', '92', '93', '94', '95', '98',
  // 3-digit
  '212', '213', '216', '218', '220', '221', '222', '223', '224', '225',
  '226', '227', '228', '229', '230', '231', '232', '233', '234', '235',
  '236', '237', '238', '239', '240', '241', '242', '243', '244', '245',
  '246', '247', '248', '249', '250', '251', '252', '253', '254', '255',
  '256', '257', '258', '260', '261', '262', '263', '264', '265', '266',
  '267', '268', '269', '290', '291', '297', '298', '299',
  '350', '351', '352', '353', '354', '355', '356', '357', '358', '359',
  '370', '371', '372', '373', '374', '375', '376', '377', '378', '380',
  '381', '382', '383', '385', '386', '387', '389',
  '420', '421', '423', '500', '501', '502', '503', '504', '505', '506',
  '507', '508', '509', '590', '591', '592', '593', '594', '595', '596',
  '597', '598', '599', '670', '672', '673', '674', '675', '676', '677',
  '678', '679', '680', '681', '682', '683', '685', '686', '687', '688',
  '689', '690', '691', '692', '850', '852', '853', '855', '856', '880',
  '886', '960', '961', '962', '963', '964', '965', '966', '967', '968',
  '970', '971', '972', '973', '974', '975', '976', '977',
  '992', '993', '994', '995', '996', '998',
])

/**
 * Derive the 1–3 digit country calling code from an international
 * (E.164) number. Returns null when no plausible code matches — e.g.
 * the number isn't international, or its prefix isn't an assigned code.
 */
export function countryCodeFromE164(phone: string): string | null {
  const digits = normalizePhone(phone)
  if (!digits || digits.length < 7 || digits.length > 15) return null
  // Prefer the longest valid prefix — "62" over "628", "1" only when
  // neither a 2- nor 3-digit prefix is a real code.
  for (let len = 3; len >= 1; len--) {
    const cc = digits.slice(0, len)
    if (!COUNTRY_CODES.has(cc)) continue
    const national = digits.slice(len)
    // The remainder must look like a national number: 6–13 digits,
    // not starting with a leading 0 (that would be a domestic form).
    if (national.length >= 6 && national.length <= 13 && national[0] !== '0') {
      return cc
    }
  }
  return null
}

/**
 * Convert a domestic-format number (leading 0, e.g. Indonesian
 * "087721603004") to international E.164 by stripping the leading
 * zeros and prepending the country code of the account's own business
 * number. Returns null when the input isn't a domestic number or the
 * country code can't be derived / doesn't produce a valid E.164.
 */
export function internationalizeDomesticPhone(
  domesticSanitized: string,
  businessDisplayNumber: string,
): string | null {
  const digits = normalizePhone(domesticSanitized)
  if (!digits.startsWith('0')) return null
  const cc = countryCodeFromE164(businessDisplayNumber)
  if (!cc) return null
  const national = digits.replace(/^0+/, '')
  if (!national) return null
  const international = cc + national
  return isValidE164(international) ? international : null
}

/**
 * Generate plausible phone number variants for retry when Meta's
 * sandbox rejects a number with error #131030 ("not in allowed list").
 *
 * Many countries use a "trunk prefix" 0 for domestic dialing that is
 * meant to be dropped in international format (e.g. Lithuanian
 * "+370 063 949 836" domestically → "+370 63 949 836" international).
 * But some sandboxes register the number with the trunk 0 included,
 * causing sends to the correct international format to fail.
 *
 * This helper yields up to 3 variants:
 *   1. The original sanitized number (first attempt)
 *   2. With a trunk 0 inserted after the country code
 *   3. With a trunk 0 removed after the country code
 *
 * Country-code lengths of 1, 2, and 3 digits are tried because we
 * don't know the user's country ahead of time.
 *
 * @param sanitized - digits-only phone number (from sanitizePhoneForMeta)
 * @returns deduplicated list of variants, original first
 */
export function phoneVariants(sanitized: string): string[] {
  if (!sanitized) return []
  const seen = new Set<string>()
  const push = (v: string) => {
    if (v && !seen.has(v)) seen.add(v)
  }

  // 1. Original
  push(sanitized)

  // 2. Insert a 0 after each plausible country-code length
  for (const ccLen of [1, 2, 3]) {
    if (sanitized.length <= ccLen) continue
    const cc = sanitized.slice(0, ccLen)
    const rest = sanitized.slice(ccLen)
    if (!rest.startsWith('0')) {
      push(cc + '0' + rest)
    }
  }

  // 3. Remove a leading 0 after each plausible country-code length
  for (const ccLen of [1, 2, 3]) {
    if (sanitized.length <= ccLen + 1) continue
    const cc = sanitized.slice(0, ccLen)
    const rest = sanitized.slice(ccLen)
    if (rest.startsWith('0')) {
      push(cc + rest.slice(1))
    }
  }

  return [...seen]
}

/**
 * Returns true when the Meta API error indicates the recipient
 * phone number isn't in the allowed list (sandbox restriction).
 * Detected via error code 131030 or the standard error text.
 */
export function isRecipientNotAllowedError(message: string): boolean {
  return /131030|not in allowed list|not in the allowed list/i.test(message)
}
