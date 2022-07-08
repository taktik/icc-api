import { b64_2ua, UtilsClass } from '../../../icc-x-api'
import { expect } from 'chai'

import 'mocha'
import { hex2ua, ua2hex } from '../../../index'
import { crypto } from '../../../node-compat'
import { RSAUtils } from '../../../icc-x-api/crypto/RSA'
import { b64Url2ua } from '../../../icc-x-api'
import { parseAsn1 } from '../../../icc-x-api/utils/asn1-parser'

describe('ArrayBuffer methods', () => {
  let utils: UtilsClass
  let rsa: RSAUtils

  before(() => {
    utils = new UtilsClass()
    rsa = new RSAUtils(crypto)
  })

  describe('truncateTrailingNulls', () => {
    it('should truncate trailing nulls out of an Uint8Array without copying', () => {
      const bytes = [72, 101, 108, 108, 111, 33]
      const originalArray = Uint8Array.from([...bytes, 0, 0])
      const truncatedArray = utils.truncateTrailingNulls(originalArray)
      expect(truncatedArray.buffer).to.equal(originalArray.buffer)
      expect(Array.from(truncatedArray)).to.eql(bytes)
    })

    it('should preserve the offset into the buffer', () => {
      const bytes = [72, 101, 108, 108, 111, 33]
      const originalBuffer = new Uint8Array([0, 0, ...bytes, 0, 0]).buffer
      const originalArray = new Uint8Array(originalBuffer, 2, bytes.length)
      const truncatedArray = utils.truncateTrailingNulls(originalArray)
      expect(truncatedArray.buffer).to.equal(originalArray.buffer)
      expect(truncatedArray.byteOffset).to.equal(originalArray.byteOffset)
      expect(Array.from(truncatedArray)).to.eql(bytes)
    })
  })

  describe('convertKeysFormat', () => {
    it('should manage jwk conversions for private keys gracefully', async () => {
      const privKey =
        '308204bd020100300d06092a864886f70d0101010500048204a7308204a302010002820101009ad2f63357da7bb9b67b235b50f66c4968b391ba3340c4c4a697d0495512bff35f3692ffdcc867fa0602819d9fe9353f049b6c69e2dbf4a987e4d1b88b9475307c41427b33af8c0a6779a8347122f032cb801b54e2ce54e2edef2b1ae1f440a797945a4d0ab541711866ea32d096fe2da943bdd8251345fd8f50b0481e88f52e326a2cc9446d125c9643650182dbebf0272da6004a954acc21f8f47236fa7d3bbb256fb932aceb9b0fe081af27a3b476d0885905526b0e5faaa7d712536b77b05ff29a36b617a17ef611b8876346cc9ff864a295cc9ec2d5fe0efb0d94d99e5db96ea36a96d95ec63de639d243c74c773a4c350236265f71260de0fcd5fbb94b02030100010282010100878dd589b68dd06e155b52e58cc9749e0151d77193964db16fbad3dea0e1bdb633d2f0799cb0ca7899f26fd1b644d51dcbc6d8f10c73508f6e2fe57f129674d472b620a305e9d94ef2b20d977cc6fe4f3ae57b08a35bcbeeb42c072d8e4ff09bcb975448c7eb52d4d66ca4f8c0b0b2f2ff94140fbec6552d5fe161b683259ea3e95278ac83826f0674a4b0b5b6c717087abce79c73c9f6bf7832ef7337d8b07912244c30e3dc59512b8d2ab0fec288d8e561e29985e7eaaaa1e010a52ed025f5fa201c893214a42d9b17eff87752902063a1accc4eb169cd408aec4ee95e588e0bf5fccb6e945e67b965c6fb5d936c1b8cbf5e6dd6f7a9b8b4dd25f68ffcb68102818100ddc101d385681b81f527edb6dce5cb7ca9e2e7cb28fa1187933628bfbc38e9c153cd3783453a7e0ffbd2ad28ef67e879e08744d7148e83b3cb3fb7282ac03feed5d44cb7e70d014b1aef213d0c057d3d6c75653739ee22ba794c0a5f6194db84c6df3e0dddbdf57b1cc114881015f49c26eda572470dc708d2a1abc4c541671b02818100b2bbe5ab2f5d41323c8c9a6b65daf0771f416abc6c8c6b08a2bcd632e6ebba0d9efb6d99b435a3ae5b1b2b3ef450648e361bc6c480902d25b459ad120c05286ab7f91e24ecc8516ba9db086e8dabf5bb4ba97ef1c4c20a751841e472a41132145623eca0ca4fbb3025b4fb7430e0e5258afedb5017c2a0dd66cb8bcf0d172991028180345bc8049b71335d81f70587b1ac88594cfb88634daf8dc807183892dcec4b351c864ddf2ecf5ac8875afd0bb74b3f76d76ed8f037a856ac7306fe45fba21cf65582a5029f09510edcb32d93ee6cb55f75665a99a991f29d38da9d705be7fbd4e3e7fe0ce4186007cb884342c5198a01fca70bf3699775313e1a722629b5019502818006e5ab5234ccb3745dd3cb2db3cb841604b5c089aee2a84ab804f37b19602558db36b69f04ce4117bc5a4b0beddfa051c092c7d3d3663ce7c492e553d9f4e4ff614412beb8086ee3e9b51319390c56ba388c3ce2d585eb6363613f9090f63ce97dfd7ae725877820be83c264547289452e9cf117a123189412a06e2fba40979102818070faf47286b59425cb7c2f617f2b7b1b280b932f131a86b82e63c4fb240525ab40323ab902c507a4aee337f9f95b89aa9151d1ae2882bff497396e680407f5407ca154f20047017022eda8fe0438a473fb38123d36bc51bffc69e3c13fab4ecf16057529265e2c0993ca8886cc019c65e9460fe549b553fa48bb0f3ca0975e78'
      const parsed = parseAsn1(new Uint8Array(hex2ua(privKey)))

      const jwk1 = utils.pkcs8ToJwk(hex2ua(privKey))
      const pkcs8 = utils.jwk2pkcs8(jwk1)
      const jwk2 = utils.pkcs8ToJwk(hex2ua(pkcs8))

      expect(jwk1.n).to.equal(jwk2.n)

      const pubKey =
        '30820122300d06092a864886f70d01010105000382010f003082010a0282010100d862a7597d21da6f8972c02fc4e71d456d3b4fdfff7beffd1759d81fdeabf63c00af6cc15a634bc3a537d7c666d648c93951a496eaeb07c58f8bbe840c4b0375201f3f6cd9ac631150d412111c9d85bf1012dc88188464c07335481af8285aa595078433563b40503ecb2db8ff50836db9fd0a14f4473eee5538766471ae4151a6ee94eeaaa2ee16d4655dff71f7b25958359894e18d535450aa0e8aa8ca72e3f6046c1bc75792748560148bedc5af3f8525465384ad2020dcf28eba45e2aab8fcfde0a79c1fcc1fbd4778cdebd3eb0af62d6e8ef845dc0251d1e0a7e6d2e358f8b4d39db5ffa4021e8a351a8d768308ddacacc2a22814301da64931c477ef410203010001'
      const jwk3 = utils.spkiToJwk(hex2ua(pubKey))
      const spki = utils.jwk2spki(jwk3)
      const jwk4 = utils.spkiToJwk(hex2ua(spki))

      expect(jwk3.n).to.equal(jwk4.n)
    })

    describe('convertKeysFormat', () => {
      it('should manage pkcs1 to jwk conversions for private keys gracefully', async () => {
        const privKeyPkcs1 = b64_2ua(
          'MIIEowIBAAKCAQEA3/qLp3xImhF0Ksxc6IZP/EFEZD8hbLGZDeIDhRKafrX07VDvaFr12hcPw1qRC4x0CqEARj2SN5+7/bHEOS1TZDdAPrCUZBRjTls/1hMtop2WPsvny6NO/OSjtAQHJKY+GIyGhZKtsOFe1lX0O//xyYEbfEUEl9ASfqdiodOpgLRIoigRBErEafPXUka/5k6o0/aUpASgrlSAvroXiYMHnF9L8vCu5F79lCmYcgtpiSwlczscuIfidZmPRZ8SZx8XyF0NDAp+q4aSGMpCg1wgvoyTh2iLbOMsB05fgNc98UepeAIj8uwS2WOwCq8+a8mlIF/OmCSvMBwz9+qYDaVYzwIDAQABAoIBAAkQ+RPhAzFVW93wTXcjb1vB1T+3kdChXxWBnMHcucCU+KKd6ur5pPJcikij7bN0I9ha9woLgP6GapN/iCFbtStH1JkVCGoFV0Bl5NoeBvQKVqQZGJC/fg7c6cbQ05cyBtkd4G4fZ1oobUXWJIpEjH2AdTkyXq1kgJ3RhGZnjSNxVWJIqZVCYBZH2/YFCWKwOanTWe7TrGBo9SpumQ+q4V+B0I0G4lxSxWcSNFosotbRdueMDQ8L/wVlX/XljdvIvjk6RRFOK+4DOtWV5TgiNYYyKd9YLsmHmLcgPEr9UeB0De8YIy8diXkpggTjwFIXe2B8ae4ZnwQ6caAZNH1zNmECgYEA8hS+tPPto/iW+/eXWN57Z21ApCg6C8InAN5FcnSEL7NliRO7JvyWzZfLXYm4kmorVJoDPRtxi13LB66+d7vJBMmzT7NfzqVM5PA/2J1yng9gGBmnyNvPrNlF4xHI7FXy1yQNV/1oxp/3aFzf30lxLw9YAZFeHp4IYBVCmVGrPWECgYEA7NtY72lr+HHBAEsh+VHg9O+H8q+V+CIa+uz5q+yNIS5TSsawKW1oES9oFJ/ii2N9Q5YrtEaBPX+iptyMo95X05jCUZy9rO9CQ33wCBNrSd7kKhgSOdplSiGa+1exINDARRGjKZrD0OCYkoZpZgA4L01xp3AqWebG0XgB3FlZlC8CgYBG4lgtODffiYz8XrVMamkMEeuZpcXJZ6JwGKWRLBkAtrEGgGaOteuaa9Y6n3cSOFBTx30nSX/n5SDsMPjIqo3j /wOoVMe7BKANcWPgk8naCnqC1BBTOjoHTN+v66c/vLMM2BuoJiWl83VIc9mB0kl4FDAa1WwP3wpoyBDmQAm6QQKBgQDIsbey7QXytxiNUhxQcKOHh2sPJN6TKPrpgWCw37hZ1DH5W0+rWqviW+P6DdvctglO+nC/yTn7TSoZ7ykwNNcAUSDeHEzPus/P9mcrwKCZMEbusATJhpdq7/ytWgmZP6ibHa2+NAgV9ijxhvjJ2AfDdQCHmtAX6yauGNyixAbWOwKBgAiik8GIFylxjiLG/b2xtSA4ps4+re5wHB8H3K5Ln/FAZOVLJkP9+RKkxN/Wgy/hRVcPkXzmINqQ9wC0Yxd5tyklNhG8ODuyKimfSWluT9wXfkZ9LgCFgdfSFDoHtMxLeUaqcVnBAjCjROdqBQFPEtppvrDpiph9ePGl+Spqj3iu'
        )
        const privKeyPkcs8 = b64_2ua(
          'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDI+aBfIbNc/DeJGpxCepaeCz8dRZpFZEdNd0ZjFA3Xiv+iTVgNHXnakKIglFJn9cjC1EGEGoi/7B+TxsZy4riCWpbFeUJd/GKpZZA/nlxJ1E0i2m7rMaMV26Pffw60JQNkzu0nL2CJHg4Q+cVaqr0tVev8J3Z7S+gD+1gnYLhwEyg0ckKLJFtcOleHf5WeEc5/9+LH/VpmxucTWzKLwMTY9paYSyg7ksUkR+T5rYVj6d8N3jvy0IpL8Cz66FXZ5Ci/9KDey3U+QIwZvkvLxOSopRsLP8M6D/L/XpL9MtDViue4nafY0FZACJ/eV9LboqF7fVRXwhCzrB+TXyrzcoqFAgMBAAECggEBAKSdUu6Y/AE91X9HfJY3MwdgzuF7EVGlQYICIHUnB+90us6F64lSi2yq6yEkXBsrBrYOhVtfIIOTNIomVoXjjp229afqGqJBB88YkX6Kh60xZ70UjaW3ko1kymVV/QUxDAaWN0nRVJD7PSpKa4xILYvkxNZUvIdhNTmNtjcK0gd5NGu7yuNdT5IXe4oO9Pd6NVaZS7MolRSGcGzjle5LSL8uoNs7Y+IZ7tU6TP7XMQrSkUZcUMqxGfvHpabq00ODlwqfOy1G1JL0lBy00RC45+kQzxwHlYoPmS+oniUC7Ltf8gmEVw/aoGNdiy3hBYzGx/Zc6vDr/Ckpss3iA4e3cgECgYEA+EeKzEcIwAFcwuNQ1ffnDoj6OpYl3pMWWRMSKISWMbswBxBckYXnd2DbAmT5BVK0eSdVBCTJHX+/QtRN7SViKF2b5j0O+CbeMlt3ipW/BWuoyM9y449oKU0D0gesWOzY4FAnzYZHJDeo4hzaGd0nsh18AhzUzTPS22Fchah+xv0CgYEAzzmDKrqlK0RmBgWSop90x6rsGJuAnEUZS+fs2bf0+cWIcvI9y+fPskKBGFTlG0KPYQ0BNcmYJsPxRTA3FsMzqcmh4H7Hizy6wNLphZdW3aBeQbDRmNlAr4coZ1ArWmMt4flUz3eck1R1fqyaF2SEJSzXk6IOi8+if9Q1r7M1HCkCgYAkGIKdYFZtU8VgsBu4f+ofutpmWh33VfsRyCwDqAMOB+Dbpg1POuCEApjUqElr9LI4SveZOp/iogf0d1k8+QpkQ/e+aXIbscrsF1Ax3cN/zj8jssVJQDgsiP3dMzBjXUvKkNy4jKUbJtxuwzMSP4zd4Ft/EyH9E2O8cVM6O1zzIQKBgEtSH0APuWthoCe+LM9ZYCwXD1veYb/rSceSVD/KoouK5g7Jx/Zumsqza5L5gJEI/26KOI9haCFnBTJd1Rg7+XJUbLdZvZP5jfP6dZDuMk+6M6hy6axCA0YJvYDX3forpIjHhLEoS8wtXcueVx/7lCCjDPSHafwdi3YlHyJu4/YJAoGAIFPLBPqE+t7JgyNCtexOzaDeGRRe602t/s9l9cIhBbFZd3D00EglgbjPyVK/dSIP+nEskZ75X9DccdGpKwfBsGgJNuqYq4RXSrmN8T3BoeAIs5NPgHZ8AIscTW2gWSP4wvgxpfnEjTVbUQvRlF9N1i5gLtY3U7er8HU47nfC/0I='
        )

        const jwk2 = utils.pkcs8ToJwk(privKeyPkcs8)
        const jwk1 = utils.pkcs8ToJwk(privKeyPkcs1)

        const privKeyPkcs1roundTrip = utils.jwk2pkcs1(jwk1)
        const privKeyPkcs8roundTrip = utils.jwk2pkcs8(jwk1)

        console.log(privKeyPkcs1roundTrip)
        console.log(privKeyPkcs8roundTrip)

        expect(privKeyPkcs1roundTrip).to.equal(ua2hex(privKeyPkcs1))
      })
    })

    it('should convert spki to jwk in a coherent way', async () => {
      const pubKey =
        '30820122300d06092a864886f70d01010105000382010f003082010a0282010100d862a7597d21da6f8972c02fc4e71d456d3b4fdfff7beffd1759d81fdeabf63c00af6cc15a634bc3a537d7c666d648c93951a496eaeb07c58f8bbe840c4b0375201f3f6cd9ac631150d412111c9d85bf1012dc88188464c07335481af8285aa595078433563b40503ecb2db8ff50836db9fd0a14f4473eee5538766471ae4151a6ee94eeaaa2ee16d4655dff71f7b25958359894e18d535450aa0e8aa8ca72e3f6046c1bc75792748560148bedc5af3f8525465384ad2020dcf28eba45e2aab8fcfde0a79c1fcc1fbd4778cdebd3eb0af62d6e8ef845dc0251d1e0a7e6d2e358f8b4d39db5ffa4021e8a351a8d768308ddacacc2a22814301da64931c477ef410203010001'
      const jwk1 = utils.spkiToJwk(hex2ua(pubKey))
      const rsaKey1 = await rsa.importKey('jwk', jwk1, ['encrypt'])
      const rsaKey2 = await rsa.importKey('spki', hex2ua(pubKey), ['encrypt'])
      const jwk2 = await rsa.exportKey(rsaKey2, 'jwk')
      const rsaKey3 = await rsa.importKey('jwk', jwk2, ['encrypt'])

      const n1 = ua2hex(b64Url2ua(jwk1.n))
      const n2 = ua2hex(b64Url2ua(jwk2.n!))

      expect(jwk1.n).to.equal(jwk2.n)
    })
  })
})
