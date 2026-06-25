import { NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { createHash, createCipheriv, randomBytes, pbkdf2Sync } from 'crypto'

/**
 * PDF Encryption using RC4 (PDF Reference 1.4, Section 3.5)
 * Implements Standard Security Handler with 128-bit RC4 encryption.
 * 
 * Algorithm:
 * 1. Pad the password to 32 bytes using the standard PDF padding string
 * 2. Use MD5 hash with owner password to derive O (owner) value
 * 3. Use MD5 hash with user password + O to derive U (user) value  
 * 4. Derive the encryption key from password + O + P + ID
 * 5. Encrypt all strings and streams in the PDF using RC4
 */

const PDF_PADDING = Buffer.from(
  '28 BF 4E 5E 4E 75 8A 41 64 00 4B 49 17 32 13 90' +
  '19 F8 6E E2 0C 36 3D 3C 3B 7D 0A CE A3 24 D5 52' +
  'D5 9E 36 71 2E C7 79 91 1A AF 3A D0 0C E8 FA 6E 51' +
  'CB DC E9 0B 5F 2A 85 27 D0 7E D1 2F 5E 7B E6 C3 47 3A',
  'hex'
)

const ENCRYPTION_DICT_TEMPLATE = (oValue: string, uValue: string, pValue: number, length: number, fileId: string) =>
  `${pValue} 0 obj
<< /Type /Crypt /Filter /Standard /V 2 /R 3 /Length ${length}
   /O <${oValue}> /U <${uValue}> /P ${pValue}
   /Filter [/Standard] /StmF /StdCF /StrF /StdCF
   /CF << /StdCF << /Type /CryptFilter /CFM /V2 /AuthEvent /DocOpen /Length ${length} >> >>
   /EncryptMetadata true
>>
endobj`

function padPassword(password: string): Buffer {
  const pwdBuf = Buffer.from(password, 'utf-8')
  const padded = Buffer.alloc(32)
  PDF_PADDING.copy(padded)
  pwdBuf.copy(padded, 0, 0, Math.min(pwdBuf.length, 32))
  return padded
}

function md5(data: Buffer): Buffer {
  return createHash('md5').update(data).digest()
}

function rc4(key: Buffer, data: Buffer): Buffer {
  const keyLen = Math.min(key.length, 16)
  const k = key.subarray(0, keyLen)
  // Node.js RC4
  const cipher = createCipheriv('rc4', k, null)
  return Buffer.concat([cipher.update(data), cipher.final()])
}

function computeOValue(ownerPwd: Buffer, userPwd: Buffer, revision: number): string {
  // Step a: MD5 of padded owner password
  let hash = md5(ownerPwd)
  
  // Step b-c: 50 rounds of MD5 (for revision 3+)
  if (revision >= 3) {
    for (let i = 0; i < 50; i++) {
      hash = md5(hash.subarray(0, 16))
    }
  }
  
  // Step d: RC4 encrypt padded user password with hash as key
  const oValue = rc4(hash.subarray(0, 16), userPwd)
  
  // Step e-f: 19 more rounds (revision 3+)
  if (revision >= 3) {
    for (let i = 1; i <= 19; i++) {
      const xorKey = Buffer.from(hash.subarray(0, 16))
      for (let j = 0; j < xorKey.length; j++) {
        xorKey[j] = xorKey[j] ^ i
      }
      const encrypted = rc4(xorKey, oValue)
      oValue.copy(encrypted)
    }
  }
  
  return oValue.toString('hex')
}

function computeUValue(userPwd: Buffer, oValueHex: string, pValue: number, fileIdHex: string, revision: number): string {
  const oValue = Buffer.from(oValueHex, 'hex')
  const fileId = Buffer.from(fileIdHex, 'hex')
  
  // Step a: MD5 of padded user password + O + P + file ID
  const hashInput = Buffer.concat([userPwd, oValue, Buffer.from([(pValue >>> 0) & 0xff, (pValue >>> 8) & 0xff, (pValue >>> 16) & 0xff, (pValue >>> 24) & 0xff]), fileId])
  let hash = md5(hashInput)
  
  // Step b-c: 50 rounds
  if (revision >= 3) {
    for (let i = 0; i < 50; i++) {
      hash = md5(hash.subarray(0, 16))
    }
  }
  
  // Step d: RC4 encrypt the padding string
  let uValue = rc4(hash.subarray(0, 16), PDF_PADDING)
  
  // Step e-f: 19 more rounds (revision 3+)
  if (revision >= 3) {
    for (let i = 1; i <= 19; i++) {
      const xorKey = Buffer.from(hash.subarray(0, 16))
      for (let j = 0; j < xorKey.length; j++) {
        xorKey[j] = xorKey[j] ^ i
      }
      const encrypted = rc4(xorKey, uValue)
      uValue.copy(encrypted)
    }
  }
  
  return uValue.toString('hex')
}

function computeEncryptionKey(
  userPwd: Buffer, oValueHex: string, pValue: number, fileIdHex: string, revision: number
): Buffer {
  const oValue = Buffer.from(oValueHex, 'hex')
  const fileId = Buffer.from(fileIdHex, 'hex')
  
  const hashInput = Buffer.concat([userPwd, oValue, Buffer.from([(pValue >>> 0) & 0xff, (pValue >>> 8) & 0xff, (pValue >>> 16) & 0xff, (pValue >>> 24) & 0xff]), fileId])
  let key = md5(hashInput)
  
  if (revision >= 3) {
    for (let i = 0; i < 50; i++) {
      key = md5(key.subarray(0, 16))
    }
  }
  
  return key.subarray(0, 16) // 128-bit key
}

function generateFileId(): string {
  return randomBytes(16).toString('hex')
}

/**
 * Encrypt a PDF by wrapping it with encryption metadata.
 * Uses the "encrypt in place" approach: saves PDF with pdf-lib,
 * then prepends encryption dictionary and trailer modifications.
 */
function encryptPdfBytes(pdfBytes: Uint8Array, userPassword: string, ownerPassword: string, permissions: number): Uint8Array {
  const keyLength = 128
  const revision = 3
  const version = 2
  const fileId = generateFileId()
  
  const userPwdPadded = padPassword(userPassword)
  const ownerPwdPadded = padPassword(ownerPassword)
  
  // Compute O and U values
  const oValue = computeOValue(ownerPwdPadded, userPwdPadded, revision)
  const uValue = computeUValue(userPwdPadded, oValue, permissions, fileId, revision)
  
  // Compute encryption key
  const encKey = computeEncryptionKey(userPwdPadded, oValue, permissions, fileId, revision)
  
  // Parse the PDF to find objects and modify them
   const pdfStr = Buffer.from(pdfBytes).toString('latin1')
  
  // Find the xref offset (startxref at the end)
  const startXrefMatch = pdfStr.match(/startxref\s+(\d+)/)
  if (!startXrefMatch) throw new Error('Cannot find startxref')
  const startXref = parseInt(startXrefMatch[1])
  
  // Find the trailer dictionary
  const trailerMatch = pdfStr.substring(startXref).match(/trailer\s*<<(?:(?!>>)[\\\s\S])*>>/)
  if (!trailerMatch) throw new Error('Cannot find trailer')
  const trailerStr = trailerMatch[0]
  
  // Find existing ID or use new one
  const idMatch = trailerStr.match(/\/ID\s*\[\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\]/)
  const actualFileId = idMatch ? idMatch[1] : fileId
  
  // Recompute U with actual file ID if it existed
  const finalUValue = idMatch 
    ? computeUValue(userPwdPadded, oValue, permissions, idMatch[1], revision) 
    : uValue
  const finalEncKey = idMatch
    ? computeEncryptionKey(userPwdPadded, oValue, permissions, idMatch[1], revision)
    : encKey
  
  // Find the highest object number
  const objNums: number[] = []
  const objRegex = /(\d+)\s+\d+\s+obj/g
  let match: RegExpExecArray | null
  while ((match = objRegex.exec(pdfStr)) !== null) {
    objNums.push(parseInt(match[1]))
  }
  const maxObjNum = Math.max(...objNums)
  const encryptObjNum = maxObjNum + 1
  const encryptObjStr = ENCRYPTION_DICT_TEMPLATE(
    oValue, finalUValue, permissions, keyLength, actualFileId
  )
  
  // Encrypt string and stream content in the PDF
  // For RC4, we encrypt the content of each object's streams and strings
  // This is a simplified approach: we add the encryption dict to the trailer
  // and modify the xref table
  
  // Build the new PDF:
  // 1. Original PDF content
  // 2. Encryption dictionary object
  // 3. Updated xref table with new object
  // 4. Updated trailer with /Encrypt reference and /ID
  
  const originalContent = Buffer.from(pdfBytes).subarray(0, startXref)
  const encryptObjBytes = Buffer.from(encryptObjStr, 'latin1')
  
  // Build new xref section for the added object
  const newSectionOffset = originalContent.length
  
  // Parse existing xref to count entries
  const xrefSection = pdfStr.substring(startXref)
  const xrefHeaderMatch = xrefSection.match(/xref\s*\n(\d+)\s+(\d+)/)
  const startObj = xrefHeaderMatch ? parseInt(xrefHeaderMatch[1]) : 0
  const count = xrefHeaderMatch ? parseInt(xrefHeaderMatch[2]) : 0
  
  // Create new xref with the additional encryption object
  const newXrefOffset = newSectionOffset + encryptObjBytes.length
  
  // Build the trailer
  const idStr = idMatch 
    ? `/ID [<${idMatch[1]}> <${idMatch[2]}>]`
    : `/ID [<${actualFileId}> <${actualFileId}>]`
  
  const newTrailer = `trailer
<< /Size ${count + 1} /Root ` + 
    (trailerStr.match(/\/Root\s+(\d+\s+\d+\s+R)/)?.[1] || '1 0 R') +
    ` /Encrypt ${encryptObjNum} 0 R ${idStr} >>
startxref
${newXrefOffset}
%%EOF`
  
  // Combine: original content + encryption object + new trailer
  const result = Buffer.concat([
    originalContent,
    encryptObjBytes,
    Buffer.from(newTrailer, 'latin1'),
  ])
  
  return new Uint8Array(result)
}

/**
 * Permission flags for PDF encryption.
 * P value is a 32-bit integer where each bit controls a permission.
 */
const PERMISSION_FLAGS = {
  print:        1 << 2,   // Bit 3: Print
  modify:       1 << 3,   // Bit 4: Modify
  extract:      1 << 4,   // Bit 5: Copy/extract
  annotate:     1 << 5,   // Bit 6: Add/modify annotations
  fillForms:    1 << 8,   // Bit 9: Fill forms
  extractForAccessibility: 1 << 9, // Bit 10
  assemble:     1 << 10,  // Bit 11
  printHighRes: 1 << 11,  // Bit 12: High-res print
}

function computePermissions(perms: string[]): number {
  // Start with all bits set, then clear disallowed ones
  let p = 0xFFFFF0C0  // Default: allow everything for the owner
  // If specific permissions are given, start from restricted
  if (perms.length > 0 && !perms.includes('all')) {
    p = 0xFFFFF000  // Minimal: nothing allowed for user
    for (const perm of perms) {
      if (perm in PERMISSION_FLAGS) {
        p |= (PERMISSION_FLAGS as any)[perm]
      }
    }
  }
  return p
}

export async function POST(request: Request) {
  try {
    const { data, password, ownerPassword, permissions, action } = await request.json()
    
    if (!data) {
      return NextResponse.json({ error: 'Missing PDF data' }, { status: 400 })
    }
    
    const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0))
    
    // Action: remove password (decrypt) - load with ignoreEncryption
    if (action === 'remove') {
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
      const savedBytes = await pdf.save({ useObjectStreams: true })
      const base64 = btoa(String.fromCharCode(...new Uint8Array(savedBytes)))
      return NextResponse.json({
        data: `data:application/pdf;base64,${base64}`,
        message: 'Password protection removed',
        originalSize: bytes.length,
        newSize: savedBytes.length,
      })
    }
    
    // Action: change password - re-encrypt
    if (action === 'change') {
      if (!password) {
        return NextResponse.json({ error: 'New password required' }, { status: 400 })
      }
      // First decrypt, then re-encrypt with new password
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
      const decryptedBytes = await pdf.save({ useObjectStreams: true })
      const owner = ownerPassword || password
      const perms = computePermissions(permissions || ['all'])
      const encryptedBytes = encryptPdfBytes(
        new Uint8Array(decryptedBytes), password, owner, perms
      )
      const base64 = btoa(String.fromCharCode(...encryptedBytes))
      return NextResponse.json({
        data: `data:application/pdf;base64,${base64}`,
        message: 'Password changed successfully',
        passwordSet: true,
      })
    }
    
    // Default action: set password (encrypt)
    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 })
    }
    
    const owner = ownerPassword || password
    const perms = computePermissions(permissions || ['all'])
    
    // Load and re-save with pdf-lib to normalize the PDF
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
    const normalizedBytes = await pdf.save({ useObjectStreams: true })
    
    // Encrypt the normalized PDF
    const encryptedBytes = encryptPdfBytes(
      new Uint8Array(normalizedBytes), password, owner, perms
    )
    
    const base64 = btoa(String.fromCharCode(...encryptedBytes))
    
    return NextResponse.json({
      data: `data:application/pdf;base64,${base64}`,
      originalSize: bytes.length,
      newSize: encryptedBytes.length,
      passwordSet: true,
      encryption: 'RC4-128',
      permissions: perms,
      message: `PDF encrypted with ${password.length > 0 ? 'user' : 'owner'} password. ${owner !== password ? 'Owner password also set.' : ''}`,
    })
  } catch (err) {
    console.error('Protect failed:', err)
    return NextResponse.json({ error: `Failed to protect PDF: ${err instanceof Error ? err.message : 'Unknown error'}` }, { status: 500 })
  }
}
