# Crypto model in iCure

## Lexic

- `"ABCD"` is a **non** encrypted key (uuid, ...)
- `{AB}` is the encryption key of the pair `AB`, where hcParty `A` gives delegation to hcParty `B`.
  The encryption key is stored encrypted in the hcPartyKeys of hcParty `A` document (see below)
- `<ABCD>_{AB}` is the key `ABCD` encrypted with encryption key `{AB}`
- `<{AB}>_{A}` is the encryption key `{AB}` encrypted with the public key of hcParty `A`

The encryption keys are stored in the hcParty document that gives delegation to other user, since only the user can modify his hcParty document in CouchDB.
The hcParty `B` needs to access the hcParty `A` document to decrypt (with his private key) the encryption key `{AB}` stored in the field hcPartyKeys.

```
## HCP A ##
hcPartyKeys: {
   A: [ <{AA}>_{A}, <{AA}>_{A} ]
   B: [ <{AB}>_{A}, <{AB}>_{B} ]
}
```

## Document type relations

```
## Patient 1234 ##
ID: "1234"
Delegations: { A->A: <ABCD>_{AA}, A->B: <ABCD>_{AB} }
EncryptionKeys: { A->A: <DCBA>_{AA}, A->B: <DCBA>_{AB} }
```

```
## Contact 4567 ##
ID: "4567"
SecretForeignKeys: [ "ABCD" ]
CryptedForeignKeys: { A->A: <1234>_{AA}, A->B: <1234>_{AB} }
EncryptionKeys: { A->A: <EFGH>_{AA}, A->B: <EFGH>_{AB} }
```

The **delegations** of the **patient** document store the encrypted secretForeignKeys that you find in clear in the **contact** document. And allows, once decrypted, to find the contacts of a patient.

On the other side, the **cryptedForeignKeys** of the **contact** document allows, once decrypted, to find the corresponding **patient** document.

The **encryptionKeys** of a document are used to encrypt the content of the corresponding document. As for the delegations, the document encryption keys are stored encrypted with the encryption keys `{AA}`, `{AB}`, ...

The **healthElement** documents are linked to patient documents in the same way as the contact. This means that the healthElement documents have also **SecretForeignKeys** and **CryptedForeignKeys**, beside the **encryptionKeys**.

## Delegations

- Delegations === encrypted foreign key of all patient icureStoredDocument => it makes the link from a patient to a storedDocument
- CryptedForeignKeys === encrypted patient.ID => it makes the link from a storedDocument to a patient
- EncryptionKeys === encrypted encryptionKey (probably symmetric)

## Multi profession

Contacts and delegations need to be segmented.
=> need to have segmented auto-delegations

# Usage

## Instalation

Install from npm

```
npm install --save icc-api
```

## ES6 import

Example
ES6 include

```javaScript
import * as IccApi from 'icc-api'
```
