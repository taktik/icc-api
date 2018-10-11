import { iccDocumentApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"

import * as _ from "lodash"
import { XHR } from "../icc-api/api/XHR"
import * as models from "../icc-api/model/models"

import { utils } from "./crypto/utils"
import { AES } from "./crypto/AES"

// noinspection JSUnusedGlobalSymbols
export class IccDocumentXApi extends iccDocumentApi {
  crypto: IccCryptoXApi

  utiRevDefs: { [key: string]: string } = {
    "com.adobe.encapsulatedPostscript": "image/eps",
    "com.adobe.illustrator.aiImage": "application/illustrator",
    "com.adobe.indesignImage": "image/indesign",
    "com.adobe.pdf": "application/pdf",
    "com.adobe.photoshopImage": "image/psd",
    "com.adobe.postscript": "application/postscript",
    "com.adobe.postscriptPfaFont": "application/x-font-type1",
    "com.adobe.postscriptPfbFont": "application/x-font-type1",
    "com.allume.stuffitArchive": "application/stuffit",
    "com.apple.applescript.script": "application/x-applescript",
    "com.apple.applescript.text": "application/x-applescript",
    "com.apple.binhexArchive": "application/binhex",
    "com.apple.diskImageUdif": "application/x-apple-diskimage",
    "com.apple.ical.ics": "text/calendar",
    "com.apple.ical.vcs": "text/x-vcalendar",
    "com.apple.macbinaryArchive": "application/macbinary",
    "com.apple.pict": "image/pict",
    "com.apple.quartzComposerComposition": "application/x-quartzcomposer",
    "com.apple.quicktimeImage": "image/x-quicktime",
    "com.apple.quicktimeMovie": "video/quicktime",
    "com.bittorrent.torrent": "application/x-bittorrent",
    "com.compuserve.gif": "image/gif",
    "com.js.efxFax": "image/efax",
    "com.kodak.flashpix.image": "image/vndfpx",
    "com.lizardtech.djvu": "image/vnd.djvu",
    "com.macromedia.shockwaveFlash": "application/x-shockwave-flash",
    "com.microsoft.advancedStreamRedirector": "video/x-ms-asx",
    "com.microsoft.advancedSystemsFormat": "video/x-ms-asf",
    "com.microsoft.bmp": "image/bmp",
    "com.microsoft.excel.xls": "application/excel",
    "com.microsoft.ico": "image/x-icon",
    "com.microsoft.powerpoint.ppt": "application/powerpoint",
    "com.microsoft.waveformAudio": "audio/wave",
    "com.microsoft.windowsDynamicLinkLibrary": "application/x-msdownload",
    "com.microsoft.windowsExecutable": "application/exe",
    "com.microsoft.windowsMediaWax": "audio/x-ms-wax",
    "com.microsoft.windowsMediaWm": "video/x-ms-wm",
    "com.microsoft.windowsMediaWma": "audio/x-ms-wma",
    "com.microsoft.windowsMediaWmd": "video/x-ms-wmd",
    "com.microsoft.windowsMediaWmp": "video/x-ms-wmp",
    "com.microsoft.windowsMediaWmv": "video/x-ms-wmv",
    "com.microsoft.windowsMediaWmx": "video/x-ms-wmx",
    "com.microsoft.windowsMediaWmz": "video/x-ms-wmz",
    "com.microsoft.windowsMediaWvx": "video/x-ms-wvx",
    "com.microsoft.word.doc": "application/msword",
    "com.netscape.javascriptSource": "text/javascript",
    "com.pkware.zipArchive": "application/zip",
    "com.rarlab.rarArchive": "application/rar",
    "com.real.realaudio": "audio/vnd.rn-realaudio",
    "com.real.realmedia": "application/vnd.rn-realmedia",
    "com.real.smil": "application/smil",
    "com.redhat.redhatPackage": "application/x-redhat-package",
    "com.sgi.sgiImage": "image/sgi",
    "com.soundblaster.soundfont": "application/x-soundfont",
    "com.sun.javaAppDescriptor": "text/vnd.sun.j2me.app-descriptor",
    "com.sun.javaArchive": "application/java-archive",
    "com.sun.javaClass": "application/java",
    "com.sun.javaSource": "text/x-java-source",
    "com.sun.javaWebStart": "application/jnlp",
    "com.truevision.tgaImage": "image/tga",
    "org.bzip.bzip2Archive": "application/x-bzip2",
    "org.debian.debianPackage": "application/x-debian-package",
    "org.gnu.gnuTarArchive": "application/x-gtar",
    "org.gnu.gnuZipArchive": "application/gzip",
    "org.neooffice.calc": "application/vnd.sun.xml.calc",
    "org.neooffice.draw": "application/vnd.sun.xml.draw",
    "org.neooffice.global": "application/vnd.sun.xml.writer.global",
    "org.neooffice.impress": "application/vnd.sun.xml.impress",
    "org.neooffice.math": "application/vnd.sun.xml.math",
    "org.neooffice.writer": "application/vnd.sun.xml.writer",
    "org.oasis.opendocument.chart": "application/vnd.oasis.opendocument.chart",
    "org.oasis.opendocument.database": "application/vnd.oasis.opendocument.database",
    "org.oasis.opendocument.formula": "application/vnd.oasis.opendocument.formula",
    "org.oasis.opendocument.graphics": "application/vnd.oasis.opendocument.graphics",
    "org.oasis.opendocument.image": "application/vnd.oasis.opendocument.image",
    "org.oasis.opendocument.presentation": "application/vnd.oasis.opendocument.presentation",
    "org.oasis.opendocument.spreadsheet": "application/vnd.oasis.opendocument.spreadsheet",
    "org.oasis.opendocument.text": "application/vnd.oasis.opendocument.text",
    "org.oasis.opendocument.textMaster": "application/vnd.oasis.opendocument.text-master",
    "org.oasis.opendocument.textWeb": "application/vnd.oasis.opendocument.text-web",
    "org.tug.tex": "text/tex",
    "org.xiph.flac": "audio/flac",
    "org.xiph.oggTheora": "video/ogg",
    "org.xiph.oggVorbis": "audio/ogg",
    "public.3gpp": "video/3gpp",
    "public.3gpp2": "video/3gpp2",
    "public.aifcAudio": "audio/aiff",
    "public.aiffAudio": "audio/aiff",
    "public.assemblySource": "text/x-asm",
    "public.avi": "video/avi",
    "public.cHeader": "text/x-c-header",
    "public.cpioArchive": "application/x-cpio",
    "public.cPlusPlusHeader": "text/x-c++-hdr",
    "public.cPlusPlusSource": "application/x-cplusplus",
    "public.cshScript": "application/x-csh",
    "public.cSource": "text/x-c-code",
    "public.css": "text/css",
    "public.dv": "video/x-dv",
    "public.flv": "video/x-flv",
    "public.html": "text/html",
    "public.isoImage": "application/x-iso-image",
    "public.jpeg": "image/jpeg",
    "public.jpeg2000": "image/jp2",
    "public.midi": "audio/midi",
    "public.mka": "audio/x-matroska",
    "public.mkv": "video/x-matroska",
    "public.mp3": "audio/mp3",
    "public.mpeg": "video/mpeg",
    "public.mpeg4": "video/mp4",
    "public.mpeg4Audio": "audio/mp4",
    "public.mpegts": "video/MP2T",
    "public.objectiveCPlusPlusSource": "text/x-objcppsrc",
    "public.objectiveCSource": "text/x-objcsrc",
    "public.opentypeFont": "font/opentype",
    "public.perlScript": "text/x-perl",
    "public.phpScript": "text/php",
    "public.plainText": "text/plain",
    "public.png": "image/png",
    "public.pythonScript": "text/x-python-script",
    "public.rtf": "text/rtf",
    "public.shellScript": "application/x-sh",
    "public.tarArchive": "application/tar",
    "public.tiff": "image/tiff",
    "public.truetypeTtfFont": "application/x-font-ttf",
    "public.ulawAudio": "audio/au",
    "public.vcard": "text/vcard",
    "public.webm": "video/webm",
    "public.xbitmapImage": "image/xbm",
    "public.xml": "text/xml",
    "unofficial.atomFeed": "application/atom+xml",
    "unofficial.m3u8Playlist": "application/x-mpegURL",
    "unofficial.opml": "text/x-opml",
    "unofficial.plsPlaylist": "audio/scpls",
    "unofficial.rdfFeed": "application/rdf+xml",
    "unofficial.rssFeed": "application/rss+xml"
  }

  utiExts: { [key: string]: string } = {
    jpg: "public.jpeg",
    jpeg: "public.jpeg",
    png: "public.png",
    rtf: "public.rtf",
    mpeg: "public.mpeg",
    mpg: "public.mpeg",
    html: "public.html",
    htm: "public.html",
    pdf: "com.adobe.pdf",
    xls: "com.microsoft.excel.xls",
    xlsx: "com.microsoft.excel.xls",
    doc: "com.microsoft.word.doc",
    docx: "com.microsoft.word.doc"
  }

  utiDefs: { [key: string]: string } = {
    "application/atom+xml": "unofficial.atomFeed",
    "application/bat": "com.microsoft.windowsExecutable",
    "application/binhex": "com.apple.binhexArchive",
    "application/binhex4": "com.apple.binhexArchive",
    "application/ecmascript": "com.netscape.javascriptSource",
    "application/eps": "com.adobe.encapsulatedPostscript",
    "application/excel": "com.microsoft.excel.xls",
    "application/exe": "com.microsoft.windowsExecutable",
    "application/gnutar": "public.tarArchive",
    "application/gzip": "org.gnu.gnuZipArchive",
    "application/illustrator": "com.adobe.illustrator.aiImage",
    "application/indesign": "com.adobe.indesignImage",
    "application/java-archive": "com.sun.javaArchive",
    "application/java-byte-code": "com.sun.javaClass",
    "application/java": "com.sun.javaClass",
    "application/javascript": "com.netscape.javascriptSource",
    "application/jnlp": "com.sun.javaWebStart",
    "application/latex": "org.tug.tex",
    "application/mac-binary": "com.apple.macbinaryArchive",
    "application/mac-binhex": "com.apple.binhexArchive",
    "application/mac-binhex40": "com.apple.binhexArchive",
    "application/macbinary": "com.apple.macbinaryArchive",
    "application/mspowerpoint": "com.microsoft.powerpoint.ppt",
    "application/msword": "com.microsoft.word.doc",
    "application/octet-stream": "com.microsoft.windowsExecutable",
    "application/pdf": "com.adobe.pdf",
    "application/photoshop": "com.adobe.photoshopImage",
    "application/php": "public.phpScript",
    "application/plain": "public.plainText",
    "application/postscript": "com.adobe.postscript",
    "application/powerpoint": "com.microsoft.powerpoint.ppt",
    "application/rar": "com.rarlab.rarArchive",
    "application/rdf+xml": "unofficial.rdfFeed",
    "application/rss+xml": "unofficial.rssFeed",
    "application/rtf": "public.rtf",
    "application/smil": "com.real.smil",
    "application/stuffit": "com.allume.stuffitArchive",
    "application/tar": "public.tarArchive",
    "application/tga": "com.truevision.tgaImage",
    "application/vnd.fpx": "com.kodak.flashpix.image",
    "application/vnd.ms-excel": "com.microsoft.excel.xls",
    "application/vnd.ms-powerpoint": "com.microsoft.powerpoint.ppt",
    "application/vnd.oasis.opendocument.chart": "org.oasis.opendocument.chart",
    "application/vnd.oasis.opendocument.database": "org.oasis.opendocument.database",
    "application/vnd.oasis.opendocument.formula": "org.oasis.opendocument.formula",
    "application/vnd.oasis.opendocument.graphics-template": "org.oasis.opendocument.graphics",
    "application/vnd.oasis.opendocument.graphics": "org.oasis.opendocument.graphics",
    "application/vnd.oasis.opendocument.image": "org.oasis.opendocument.image",
    "application/vnd.oasis.opendocument.presentation-template":
      "org.oasis.opendocument.presentation",
    "application/vnd.oasis.opendocument.presentation": "org.oasis.opendocument.presentation",
    "application/vnd.oasis.opendocument.spreadsheet-template": "org.oasis.opendocument.spreadsheet",
    "application/vnd.oasis.opendocument.spreadsheet": "org.oasis.opendocument.spreadsheet",
    "application/vnd.oasis.opendocument.text-master": "org.oasis.opendocument.textMaster",
    "application/vnd.oasis.opendocument.text-template": "org.oasis.opendocument.text",
    "application/vnd.oasis.opendocument.text-web": "org.oasis.opendocument.textWeb",
    "application/vnd.oasis.opendocument.text": "org.oasis.opendocument.text",
    "application/vnd.rn-realmedia": "com.real.realmedia",
    "application/vnd.sun.xml.calc.template": "org.neooffice.calc",
    "application/vnd.sun.xml.calc": "org.neooffice.calc",
    "application/vnd.sun.xml.draw.template": "org.neooffice.draw",
    "application/vnd.sun.xml.draw": "org.neooffice.draw",
    "application/vnd.sun.xml.impress.template": "org.neooffice.impress",
    "application/vnd.sun.xml.impress": "org.neooffice.impress",
    "application/vnd.sun.xml.math": "org.neooffice.math",
    "application/vnd.sun.xml.writer.global": "org.neooffice.global",
    "application/vnd.sun.xml.writer.template": "org.neooffice.writer",
    "application/vnd.sun.xml.writer": "org.neooffice.writer",
    "application/vndms-excel": "com.microsoft.excel.xls",
    "application/vndms-powerpoint": "com.microsoft.powerpoint.ppt",
    "application/vndrn-realmedia": "com.real.realmedia",
    "application/x-apple-diskimage": "com.apple.diskImageUdif",
    "application/x-applescript": "com.apple.applescript.script",
    "application/x-bat": "com.microsoft.windowsExecutable",
    "application/x-binary": "com.apple.macbinaryArchive",
    "application/x-binhex40": "com.apple.binhexArchive",
    "application/x-bittorrent": "com.bittorrent.torrent",
    "application/x-bzip2": "org.bzip.bzip2Archive",
    "application/x-cpio": "public.cpioArchive",
    "application/x-cplusplus": "public.cPlusPlusSource",
    "application/x-csh": "public.cshScript",
    "application/x-deb": "org.debian.debianPackage",
    "application/x-debian-package": "org.debian.debianPackage",
    "application/x-eps": "com.adobe.encapsulatedPostscript",
    "application/x-excel": "com.microsoft.excel.xls",
    "application/x-exe": "com.microsoft.windowsExecutable",
    "application/x-flac": "org.xiph.flac",
    "application/x-font-ttf": "public.truetypeTtfFont",
    "application/x-font-type1": "com.adobe.postscriptPfaFont",
    "application/x-gtar": "org.gnu.gnuTarArchive",
    "application/x-gzip": "org.gnu.gnuZipArchive",
    "application/x-iso-image": "public.isoImage",
    "application/x-java-class": "com.sun.javaClass",
    "application/x-java": "com.sun.javaWebStart",
    "application/x-javascript": "com.netscape.javascriptSource",
    "application/x-latex": "org.tug.tex",
    "application/x-mac-binhex40": "com.apple.binhexArchive",
    "application/x-macbinary": "com.apple.macbinaryArchive",
    "application/x-midi": "public.midi",
    "application/x-mpegURL": "unofficial.m3u8Playlist",
    "application/x-ms-wmd": "com.microsoft.windowsMediaWmd",
    "application/x-ms-wmz": "com.microsoft.windowsMediaWmz",
    "application/x-msdos-program": "com.microsoft.windowsExecutable",
    "application/x-msdownload": "com.microsoft.windowsExecutable",
    "application/x-msexcel": "com.microsoft.excel.xls",
    "application/x-mspowerpoint": "com.microsoft.powerpoint.ppt",
    "application/x-pdf": "com.adobe.pdf",
    "application/x-perl": "public.perlScript",
    "application/x-php": "public.phpScript",
    "application/x-quartzcomposer": "com.apple.quartzComposerComposition",
    "application/x-rar-compressed": "com.rarlab.rarArchive",
    "application/x-redhat-package": "com.redhat.redhatPackage",
    "application/x-rpm": "com.redhat.redhatPackage",
    "application/x-rtf": "public.rtf",
    "application/x-sh": "public.shellScript",
    "application/x-shellscript": "public.shellScript",
    "application/x-shockwave-flash": "com.macromedia.shockwaveFlash",
    "application/x-sit": "com.allume.stuffitArchive",
    "application/x-smil": "com.real.smil",
    "application/x-soundfont": "com.soundblaster.soundfont",
    "application/x-stuffit": "com.allume.stuffitArchive",
    "application/x-tar": "public.tarArchive",
    "application/x-tex": "org.tug.tex",
    "application/x-texinfo": "org.tug.tex",
    "application/x-troff-msvideo": "public.avi",
    "application/x-zip-compressed": "com.pkware.zipArchive",
    "application/xhtml+xml": "public.html",
    "application/xml": "public.xml",
    "application/zip": "com.pkware.zipArchive",
    "audio/3gpp": "public.3gpp",
    "audio/3gpp2": "public.3gpp2",
    "audio/aiff": "public.aiffAudio",
    "audio/au": "public.ulawAudio",
    "audio/basic": "public.ulawAudio",
    "audio/flac": "org.xiph.flac",
    "audio/mid": "public.midi",
    "audio/midi": "public.midi",
    "audio/mp3": "public.mp3",
    "audio/mp4": "public.mpeg4Audio",
    "audio/mp4a-latm": "public.mpeg4Audio",
    "audio/mpeg": "public.mp3",
    "audio/mpeg3": "public.mp3",
    "audio/mpegurl": "unofficial.m3uPlaylist",
    "audio/mpg": "public.mp3",
    "audio/ogg": "org.xiph.oggVorbis",
    "audio/scpls": "unofficial.plsPlaylist",
    "audio/snd": "public.ulawAudio",
    "audio/vnd.rn-realaudio": "com.real.realaudio",
    "audio/wav": "com.microsoft.waveformAudio",
    "audio/wave": "com.microsoft.waveformAudio",
    "audio/webm": "public.webm",
    "audio/x-adpcm": "public.ulawAudio",
    "audio/x-aiff": "public.aiffAudio",
    "audio/x-au": "public.ulawAudio",
    "audio/x-flac": "org.xiph.flac",
    "audio/x-matroska": "public.mka",
    "audio/x-mid": "public.midi",
    "audio/x-midi": "public.midi",
    "audio/x-mp3": "public.mp3",
    "audio/x-mpeg-3": "public.mp3",
    "audio/x-mpeg": "public.mp3",
    "audio/x-mpeg3": "public.mp3",
    "audio/x-mpegurl": "unofficial.m3uPlaylist",
    "audio/x-mpg": "public.mp3",
    "audio/x-ms-wax": "com.microsoft.windowsMediaWax",
    "audio/x-ms-wma": "com.microsoft.windowsMediaWma",
    "audio/x-ogg": "org.xiph.oggVorbis",
    "audio/x-pn-realaudio-plugin": "com.real.realaudio",
    "audio/x-pn-realaudio": "com.real.realaudio",
    "audio/x-pn-wav": "com.microsoft.waveformAudio",
    "audio/x-realaudio": "com.real.realmedia",
    "audio/x-scpls": "unofficial.plsPlaylist",
    "audio/x-wav": "com.microsoft.waveformAudio",
    "font/opentype": "public.opentypeFont",
    "image/bmp": "com.microsoft.bmp",
    "image/efax": "com.js.efxFax",
    "image/eps": "com.adobe.encapsulatedPostscript",
    "image/fpx": "com.kodak.flashpix.image",
    "image/gif": "com.compuserve.gif",
    "image/indd": "com.adobe.indesignImage",
    "image/indesign": "com.adobe.indesignImage",
    "image/jp2": "public.jpeg2000",
    "image/jpeg": "public.jpeg",
    "image/ms-bmp": "com.microsoft.bmp",
    "image/photoshop": "com.adobe.photoshopImage",
    "image/pict": "com.apple.pict",
    "image/pipeg": "public.jpeg",
    "image/pjpeg": "public.jpeg",
    "image/png": "public.png",
    "image/psd": "com.adobe.photoshopImage",
    "image/sgi": "com.sgi.sgiImage",
    "image/targa": "com.truevision.tgaImage",
    "image/tga": "com.truevision.tgaImage",
    "image/tiff": "public.tiff",
    "image/vnd.djvu": "com.lizardtech.djvu",
    "image/vndfpx": "com.kodak.flashpix.image",
    "image/vndnet-fpx": "com.kodak.flashpix.image",
    "image/webp": "public.webp",
    "image/x-bitmap": "com.microsoft.bmp",
    "image/x-bmp": "com.microsoft.bmp",
    "image/x-djvu": "com.lizardtech.djvu",
    "image/x-eps": "com.adobe.encapsulatedPostscript",
    "image/x-icon": "com.microsoft.ico",
    "image/x-indesign": "com.adobe.indesignImage",
    "image/x-macpict": "com.apple.pict",
    "image/x-ms-bmp": "com.microsoft.bmp",
    "image/x-photoshop": "com.adobe.photoshopImage",
    "image/x-pict": "com.apple.pict",
    "image/x-quicktime": "com.apple.quicktimeImage",
    "image/x-tiff": "public.tiff",
    "image/x-windows-bmp": "com.microsoft.bmp",
    "image/x-xbitmap": "com.microsoft.bmp",
    "image/x-xbm": "public.xbitmapImage",
    "image/xbm": "public.xbitmapImage",
    "multipart/x-gzip": "org.gnu.gnuZipArchive",
    "multipart/x-zip": "com.pkware.zipArchive",
    "music/crescendo": "public.midi",
    "text/calendar": "com.apple.ical.ics",
    "text/css": "public.css",
    "text/directory": "public.vcard",
    "text/ecmascript": "com.netscape.javascriptSource",
    "text/html": "public.html",
    "text/javascript": "com.netscape.javascriptSource",
    "text/php": "public.phpScript",
    "text/plain": "public.plainText",
    "text/richtext": "public.rtf",
    "text/rtf": "public.rtf",
    "text/ruby-script": "public.rubyScript",
    "text/tex": "org.tug.tex",
    "text/vcard": "public.vcard",
    "text/vnd.sun.j2me.app-descriptor": "com.sun.javaAppDescriptor",
    "text/x-asm": "public.assemblySource",
    "text/x-c-code": "public.cSource",
    "text/x-c-header": "public.cHeader",
    "text/x-c": "public.cSource",
    "text/x-c++-code": "public.cPlusPlusSource",
    "text/x-c++-hdr": "public.cPlusPlusHeader",
    "text/x-c++-src": "public.cPlusPlusSource",
    "text/x-c++src": "public.cPlusPlusSource",
    "text/x-h": "public.cHeader",
    "text/x-java-source": "com.sun.javaSource",
    "text/x-latex": "org.tug.tex",
    "text/x-objcppsrc": "public.objectiveCPlusPlusSource",
    "text/x-objcsrc": "public.objectiveCSource",
    "text/x-opml": "unofficial.opml",
    "text/x-perl-script": "public.perlScript",
    "text/x-perl": "public.perlScript",
    "text/x-php-script": "public.phpScript",
    "text/x-python-script": "public.pythonScript",
    "text/x-python": "public.pythonScript",
    "text/x-scriptcsh": "public.cshScript",
    "text/x-scriptperl-module": "public.perlScript",
    "text/x-scriptperl": "public.perlScript",
    "text/x-scriptphyton": "public.pythonScript",
    "text/x-scriptsh": "public.shellScript",
    "text/x-server-parsed-html": "public.html",
    "text/x-tex": "org.tug.tex",
    "text/x-vcalendar": "com.apple.ical.vcs",
    "text/x-vcard": "public.vcard",
    "text/xhtml": "public.html",
    "text/xml": "public.xml",
    "video/3gpp": "public.3gpp",
    "video/3gpp2": "public.3gpp2",
    "video/avi": "public.avi",
    "video/MP2T": "public.mpegts",
    "video/mp4": "public.mpeg4",
    "video/mp4v": "public.mpeg4",
    "video/mpeg": "public.mpeg",
    "video/mpg": "public.mpeg",
    "video/msvideo": "public.avi",
    "video/ogg": "org.xiph.oggTheora",
    "video/quicktime": "com.apple.quicktimeMovie",
    "video/webm": "public.webm",
    "video/x-dv": "public.dv",
    "video/x-flv": "public.flv",
    "video/x-m4v": "public.mpeg4",
    "video/x-matroska": "public.mkv",
    "video/x-mpeg": "public.mpeg",
    "video/x-mpg": "public.mpeg",
    "video/x-ms-asf-plugin": "com.microsoft.advancedSystemsFormat",
    "video/x-ms-asf": "com.microsoft.advancedSystemsFormat",
    "video/x-ms-asx": "com.microsoft.advancedStreamRedirector",
    "video/x-ms-wm": "com.microsoft.windowsMediaWm",
    "video/x-ms-wmd": "com.microsoft.windowsMediaWmd",
    "video/x-ms-wmp": "com.microsoft.windowsMediaWmp",
    "video/x-ms-wmv": "com.microsoft.windowsMediaWmv",
    "video/x-ms-wmx": "com.microsoft.windowsMediaWmx",
    "video/x-ms-wmz": "com.microsoft.windowsMediaWmz",
    "video/x-ms-wvx": "com.microsoft.windowsMediaWvx",
    "video/x-msvideo": "public.avi",
    "video/x-ogg": "org.xiph.oggTheora",
    "x-msdos-program": "com.microsoft.windowsExecutable",
    "x-music/x-midi": "public.midi"
  }

  constructor(host: string, headers: Array<XHR.Header>, crypto: IccCryptoXApi) {
    super(host, headers)
    this.crypto = crypto
  }

  // noinspection JSUnusedGlobalSymbols
  newInstance(user: models.UserDto, message: models.MessageDto, c: any) {
    const document = _.extend(
      {
        id: this.crypto.randomUuid(),
        _type: "org.taktik.icure.entities.Document",
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: user.healthcarePartyId,
        author: user.id,
        codes: [],
        tags: []
      },
      c || {}
    )

    return this.initDelegationsAndEncryptionKeys(user, message, document)
  }

  private initDelegationsAndEncryptionKeys(
    user: models.UserDto,
    message: models.MessageDto | null,
    document: models.DocumentDto
  ): Promise<models.DocumentDto> {
    return this.crypto
      .extractDelegationsSFKs(message, user.healthcarePartyId!)
      .then(secretForeignKeys =>
        Promise.all([
          this.crypto.initObjectDelegations(
            document,
            message,
            user.healthcarePartyId!,
            secretForeignKeys[0]
          ),
          this.crypto.initEncryptionKeys(document, user.healthcarePartyId!)
        ])
      )
      .then(initData => {
        const dels = initData[0]
        const eks = initData[1]
        _.extend(document, {
          delegations: dels.delegations,
          cryptedForeignKeys: dels.cryptedForeignKeys,
          secretForeignKeys: dels.secretForeignKeys,
          encryptionKeys: eks.encryptionKeys
        })

        let promise = Promise.resolve(document)
        ;(user.autoDelegations
          ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
          : []
        ).forEach(
          delegateId =>
            (promise = promise.then(contact =>
              this.crypto.addDelegationsAndEncryptionKeys(
                message,
                contact,
                user.healthcarePartyId!,
                delegateId,
                dels.secretId,
                eks.secretId
              )
            ))
        )
        return promise
      })
  }

  initEncryptionKeys(user: models.UserDto, document: models.DocumentDto) {
    return this.crypto.initEncryptionKeys(document, user.healthcarePartyId!).then(eks => {
      let promise = Promise.resolve(
        _.extend(document, {
          encryptionKeys: eks.encryptionKeys
        })
      )
      ;(user.autoDelegations
        ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
        : []
      ).forEach(
        delegateId =>
          (promise = promise.then(contact =>
            this.crypto
              .appendEncryptionKeys(contact, user.healthcarePartyId!, eks.secretId)
              .then(extraEks => {
                return _.extend(contact, {
                  encryptionKeys: extraEks.encryptionKeys
                })
              })
          ))
      )
      return promise
    })
  }

  // noinspection JSUnusedGlobalSymbols
  findByMessage(hcpartyId: string, message: models.MessageDto) {
    return this.crypto
      .extractDelegationsSFKs(message, hcpartyId)
      .then(secretForeignKeys =>
        this.findByHCPartyMessageSecretFKeys(hcpartyId, secretForeignKeys.join(","))
      )
      .then(documents => this.decrypt(hcpartyId, documents))
      .then(function(decryptedForms) {
        return decryptedForms
      })
  }

  decrypt(
    hcpartyId: string,
    documents: Array<models.DocumentDto>
  ): Promise<Array<models.DocumentDto> | void> {
    return Promise.all(
      documents.map(document =>
        this.crypto
          .decryptAndImportAesHcPartyKeysInDelegations(hcpartyId, document.delegations!)
          .then(
            (
              decryptedAndImportedAesHcPartyKeys: Array<{ delegatorId: string; key: CryptoKey }>
            ) => {
              var collatedAesKeys: { [key: string]: CryptoKey } = {}
              decryptedAndImportedAesHcPartyKeys.forEach(
                k => (collatedAesKeys[k.delegatorId] = k.key)
              )
              return this.crypto
                .decryptDelegationsSFKs(
                  document.delegations![hcpartyId],
                  collatedAesKeys,
                  document.id!
                )
                .then((sfks: Array<string>) => {
                  if (!sfks || !sfks.length) {
                    console.log("Cannot decrypt document", document.id)
                    return Promise.resolve(document)
                  }

                  if (sfks.length && document.encryptedSelf) {
                    return this.crypto.AES.importKey("raw", utils.hex2ua(sfks[0].replace(/-/g, "")))
                      .then(
                        (key: CryptoKey) =>
                          new Promise((resolve: (value: ArrayBuffer | null) => any) => {
                            AES.decrypt(key, utils.text2ua(atob(document.encryptedSelf!))).then(
                              resolve,
                              () => {
                                console.log("Cannot decrypt document", document.id)
                                resolve(null)
                              }
                            )
                          })
                      )
                      .then((decrypted: ArrayBuffer | null) => {
                        if (decrypted) {
                          document = _.extend(document, JSON.parse(utils.ua2text(decrypted)))
                        }
                        return document
                      })
                  } else {
                    return Promise.resolve(document)
                  }
                })
            }
          )
      )
    ).catch(function(e: Error) {
      console.log(e)
    })
  }

  // noinspection JSUnusedGlobalSymbols
  getAttachmentUrl(
    documentId: string,
    attachmentId: string,
    sfks: Array<{ delegatorId: string; key: CryptoKey }>
  ) {
    return (
      this.host +
      "/document/{documentId}/attachment/{attachmentId}"
        .replace("{documentId}", documentId)
        .replace("{attachmentId}", attachmentId) +
      (sfks && sfks.length ? "?enckeys=" + sfks.join(",") : "")
    )
  }

  // noinspection JSUnusedGlobalSymbols
  uti(mimeType: string, extension: string) {
    return (
      (mimeType && mimeType !== "application/octet-stream"
        ? this.utiDefs[mimeType]
        : this.utiExts[extension]) || this.utiDefs[mimeType]
    )
  }

  // noinspection JSUnusedGlobalSymbols
  mimeType(uti: string) {
    return this.utiRevDefs[uti]
  }
}
