/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-function */
/* (C) Stefan John / Stenway / Stenway.com / 2023 */

import { Base64String, InvalidUtf16StringError, ReliableTxtDecoder, ReliableTxtEncoder, ReliableTxtEncoding, ReliableTxtLines, Utf16String } from "@stenway/reliabletxt"

// ----------------------------------------------------------------------

export class OmlDocument {
	content: any
	encoding: ReliableTxtEncoding

	constructor(content: any, encoding: ReliableTxtEncoding = ReliableTxtEncoding.Utf8) {
		this.content = content
		this.encoding = encoding
	}

	toString(formatting: OmlFormatting | null = null, replacer: OmlReplacer | null = null) {
		return Oml.stringify(this.content, formatting, replacer)
	}

	getBytes(formatting: OmlFormatting | null = null, replacer: OmlReplacer | null = null): Uint8Array {
		const text = this.toString(formatting, replacer)
		return ReliableTxtEncoder.encode(text, this.encoding)
	}

	toBase64String(formatting: OmlFormatting | null = null, replacer: OmlReplacer | null = null): string {
		const text = this.toString(formatting, replacer)
		return Base64String.fromText(text, this.encoding)
	}
	
	static parse(str: string, reviver: OmlReviver | null = null, encoding: ReliableTxtEncoding = ReliableTxtEncoding.Utf8) {
		const content = Oml.parse(str, reviver)
		return new OmlDocument(content, encoding)
	}

	static fromBytes(bytes: Uint8Array, reviver: OmlReviver | null = null): OmlDocument {
		const document = ReliableTxtDecoder.decode(bytes)
		return this.parse(document.text, reviver, document.encoding)
	}

	static fromBase64String(base64Str: string, reviver: OmlReviver | null = null): OmlDocument {
		const bytes = Base64String.toBytes(base64Str)
		return this.fromBytes(bytes, reviver)
	}
}

// ----------------------------------------------------------------------

export class OmlParserError extends Error {
	readonly index: number
	readonly lineIndex: number
	readonly linePosition: number
	
	constructor(index: number, lineIndex: number, linePosition: number, message: string) {
		super(`${message} (${lineIndex+1}, ${linePosition+1})`)
		this.index = index
		this.lineIndex = lineIndex
		this.linePosition = linePosition
	}
}

// ----------------------------------------------------------------------

export interface OmlFormatting {
	indentation?: string
	beforeEqual?: string
	afterEqual?: string
	alignChar?: string | null
	maxLevel?: number
	reduceSimpleArray?: boolean
}

// ----------------------------------------------------------------------

export type OmlReviver = (owner: object | null, key: string | number | null, value: any, source: string | null, index: number) => any

// ----------------------------------------------------------------------

export type OmlReplacer = (root: any, owner: object | null, key: string | number | null, value: any, cyclic: boolean) => any

// ----------------------------------------------------------------------

export abstract class Oml {
	static parse(text: string, reviver: OmlReviver | null = null): any {
		return new OmlParser(text, reviver).parse()
	}

	static stringify(value: any, formatting: OmlFormatting | null = null, replacer: OmlReplacer | null = null): string {
		if (formatting !== null) {
			if (formatting.indentation !== undefined) { OmlSerializer.validateWhitespaceString(formatting.indentation) }
			else { formatting.indentation = "\t" }

			if (formatting.beforeEqual !== undefined) { OmlSerializer.validateWhitespaceString(formatting.beforeEqual) }
			else { formatting.beforeEqual = " " }

			if (formatting.afterEqual !== undefined) { OmlSerializer.validateWhitespaceString(formatting.afterEqual) }
			else { formatting.afterEqual = " " }

			if (formatting.alignChar !== undefined && formatting.alignChar !== null) {
				OmlSerializer.validateWhitespaceString(formatting.alignChar, true) 
			} else if (formatting.alignChar === undefined) {
				formatting.alignChar = " "
			}

			if (formatting.reduceSimpleArray === undefined) { formatting.reduceSimpleArray = true }
		}
		const strings: string[] = []
		OmlSerializer.serializeValue(value, formatting, "", replacer, value, strings, [])
		return strings.join("")
	}
}

// ----------------------------------------------------------------------

class OmlParser {
	private text: string
	private index: number = 0
	private reviver: OmlReviver | null

	constructor(text: string, reviver: OmlReviver | null) {
		if (text.length === 0) { throw new RangeError(`Empty string not allowed`) }
		this.text = text
		this.reviver = reviver
	}

	private static readonly stringNotClosed: string					= "String not closed"
	private static readonly invalidStringLineBreak: string			= "Invalid string line break"
	private static readonly invalidCharacterAfterString: string		= "Invalid character after string"

	private static readonly charNotClosed: string					= "Char not closed"
	private static readonly invalidCharSequence: string				= "Invalid char sequence"
	private static readonly invalidCharacterAfterChar: string		= "Invalid character after char"

	private static readonly arrayNotClosed: string					= "Array not closed"
	private static readonly wsRequiredAfterArrayElement: string		= "Whitespace required after array element"
	private static readonly invalidCharacterAfterArray: string		= "Invalid character after array"

	private static readonly objectNotClosed: string					= "Object not closed"
	private static readonly equalSignExpected: string				= "Equal sign expected"
	private static readonly wsRequiredAfterObjectElement: string	= "Whitespace required after object element"
	private static readonly invalidCharacterAfterObject: string		= "Invalid character after object"

	private static readonly invalidCharInValue: string				= "Invalid character in value"

	private skipWhitespaceAndComments(): boolean {
		if (this.index >= this.text.length) { return false }
		let readWsOrComments = false
		wsLoop: for (;;) {
			let codeUnit = this.text.charCodeAt(this.index)
			switch (codeUnit) {
			case 0x0009: case 0x000A: case 0x000B: case 0x000C: case 0x000D: case 0x0020: case 0x0085: case 0x00A0: case 0x1680: case 0x2000: case 0x2001: case 0x2002: case 0x2003: case 0x2004: case 0x2005: case 0x2006: case 0x2007: case 0x2008: case 0x2009: case 0x200A: case 0x2028: case 0x2029: case 0x202F: case 0x205F: case 0x3000:
				readWsOrComments = true
				this.index++
				if (this.index >= this.text.length) { break wsLoop }
				break
			case 0x0023:
				readWsOrComments = true
				for (;;) {
					this.index++
					if (this.index >= this.text.length) { break wsLoop }
					codeUnit = this.text.charCodeAt(this.index)
					if (codeUnit === 0x000A) {
						this.index++
						break 
					}
				}
				break
			default:
				break wsLoop
			}
		}
		return readWsOrComments
	}

	private parseString(): string {
		this.index++
		const strCodeUnits: string[] = []
		stringCharLoop: for (;;) {
			if (this.index >= this.text.length) { throw this.getError(OmlParser.stringNotClosed) }
			let codeUnit = this.text.charCodeAt(this.index)
			this.index++
			switch (codeUnit) {
			case 0x000A:
				throw this.getError(OmlParser.stringNotClosed, -1)
			case 0x0022:
				if (this.index >= this.text.length) { break stringCharLoop }
				codeUnit = this.text.charCodeAt(this.index)
				switch (codeUnit) {
				case 0x0022:
					strCodeUnits.push("\"")
					this.index++
					break
				case 0x000A:
				case 0x0023:
				case 0x003D:
				case 0x005D:
				case 0x007D:
				case 0x0009: case 0x000B: case 0x000C: case 0x000D: case 0x0020: case 0x0085: case 0x00A0: case 0x1680: case 0x2000: case 0x2001: case 0x2002: case 0x2003: case 0x2004: case 0x2005: case 0x2006: case 0x2007: case 0x2008: case 0x2009: case 0x200A: case 0x2028: case 0x2029: case 0x202F: case 0x205F: case 0x3000:
					break stringCharLoop
				case 0x002F:
					this.index++
					if (this.index >= this.text.length) { throw this.getError(OmlParser.invalidStringLineBreak) }
					codeUnit = this.text.charCodeAt(this.index)
					if (codeUnit !== 0x0022) { throw this.getError(OmlParser.invalidStringLineBreak) }
					strCodeUnits.push("\n")
					this.index++
					break
				default:
					throw this.getError(OmlParser.invalidCharacterAfterString)
				}
				break
			default:
				strCodeUnits.push(String.fromCharCode(codeUnit))
				if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
					if (codeUnit >= 0xDC00 || this.index >= this.text.length) { throw new InvalidUtf16StringError() }
					const secondCodeUnit: number = this.text.charCodeAt(this.index)
					if (!(secondCodeUnit >= 0xDC00 && secondCodeUnit <= 0xDFFF)) { throw new InvalidUtf16StringError() }
					strCodeUnits.push(String.fromCharCode(secondCodeUnit))
					this.index++
				}
				break
			}
		}
		return strCodeUnits.join("")
	}

	private parseChar(): string {
		let result: string = ""
		this.index++
		if (this.index >= this.text.length) { throw this.getError(OmlParser.charNotClosed) }
		let codeUnit = this.text.charCodeAt(this.index)
		this.index++
		switch (codeUnit) {
		case 0x000A:
			throw this.getError(OmlParser.charNotClosed, -1)
		case 0x0027:
			if (this.index >= this.text.length) { throw this.getError(OmlParser.invalidCharSequence) }
			codeUnit = this.text.charCodeAt(this.index)
			switch (codeUnit) {
			case 0x0027:
				result = "'"
				this.index++
				break
			case 0x002F:
				this.index++
				if (this.index >= this.text.length) { throw this.getError(OmlParser.invalidCharSequence) }
				codeUnit = this.text.charCodeAt(this.index)
				if (codeUnit !== 0x0027) { throw this.getError(OmlParser.invalidCharSequence) }
				result = "\n"
				this.index++
				break
			default:
				throw this.getError(OmlParser.invalidCharSequence)
			}
			break
		default:
			result = String.fromCharCode(codeUnit)
			if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
				if (codeUnit >= 0xDC00 || this.index >= this.text.length) { throw new InvalidUtf16StringError() }
				const secondCodeUnit: number = this.text.charCodeAt(this.index)
				if (!(secondCodeUnit >= 0xDC00 && secondCodeUnit <= 0xDFFF)) { throw new InvalidUtf16StringError() }
				result += String.fromCharCode(secondCodeUnit)
				this.index++
			}
		}
		if (this.index >= this.text.length) { throw this.getError(OmlParser.invalidCharSequence) }
		codeUnit = this.text.charCodeAt(this.index)
		if (codeUnit !== 0x0027) { throw this.getError(OmlParser.invalidCharSequence) }
		this.index++
		
		if (this.index < this.text.length) {
			codeUnit = this.text.charCodeAt(this.index)
			switch(codeUnit) {
			case 0x000A:
			case 0x0023:
			case 0x005D:
			case 0x007D:
			case 0x0009: case 0x000B: case 0x000C: case 0x000D: case 0x0020: case 0x0085: case 0x00A0: case 0x1680: case 0x2000: case 0x2001: case 0x2002: case 0x2003: case 0x2004: case 0x2005: case 0x2006: case 0x2007: case 0x2008: case 0x2009: case 0x200A: case 0x2028: case 0x2029: case 0x202F: case 0x205F: case 0x3000:
				break
			default:
				throw this.getError(OmlParser.invalidCharacterAfterChar)
			}
		}
		return result
	}

	private parseArray(): any[] {
		this.index++
		const array: any[] = []
		loop: for (;;) {
			const hasReadWs = this.skipWhitespaceAndComments()
			if (this.index >= this.text.length) { throw this.getError(OmlParser.arrayNotClosed) }
			let codeUnit = this.text.charCodeAt(this.index)
			if (codeUnit === 0x005D) {
				this.index++
				if (this.index >= this.text.length) { break loop }
				codeUnit = this.text.charCodeAt(this.index)
				switch(codeUnit) {
				case 0x000A:
				case 0x0023:
				case 0x005D:
				case 0x007D:
				case 0x0009: case 0x000B: case 0x000C: case 0x000D: case 0x0020: case 0x0085: case 0x00A0: case 0x1680: case 0x2000: case 0x2001: case 0x2002: case 0x2003: case 0x2004: case 0x2005: case 0x2006: case 0x2007: case 0x2008: case 0x2009: case 0x200A: case 0x2028: case 0x2029: case 0x202F: case 0x205F: case 0x3000:
					break loop
				default:
					throw this.getError(OmlParser.invalidCharacterAfterArray)
				}
			} else {
				if (array.length > 0 && !hasReadWs) { throw this.getError(OmlParser.wsRequiredAfterArrayElement) }
				const element = this.parseAny(array, array.length)
				array.push(element)
			}
		}
		return array
	}

	private parseObject(): object {
		this.index++
		const object: any = {}
		let firstRun = true
		loop: for (;;) {
			const hasReadWs = this.skipWhitespaceAndComments()
			if (this.index >= this.text.length) { throw this.getError(OmlParser.objectNotClosed) }
			let codeUnit = this.text.charCodeAt(this.index)
			if (codeUnit === 0x007D) {
				this.index++
				if (this.index >= this.text.length) { break loop }
				codeUnit = this.text.charCodeAt(this.index)
				switch(codeUnit) {
				case 0x000A:
				case 0x0023:
				case 0x005D:
				case 0x007D:
				case 0x0009: case 0x000B: case 0x000C: case 0x000D: case 0x0020: case 0x0085: case 0x00A0: case 0x1680: case 0x2000: case 0x2001: case 0x2002: case 0x2003: case 0x2004: case 0x2005: case 0x2006: case 0x2007: case 0x2008: case 0x2009: case 0x200A: case 0x2028: case 0x2029: case 0x202F: case 0x205F: case 0x3000:
					break loop
				default:
					throw this.getError(OmlParser.invalidCharacterAfterObject)
				}
			}
			if (firstRun) { firstRun = false }
			else if (!hasReadWs) { throw this.getError(OmlParser.wsRequiredAfterArrayElement) }
			let key: string
			if (codeUnit === 0x0022) {
				key = this.parseString()
			} else {
				key = this.parseValueAsString()
			}
			this.skipWhitespaceAndComments()
			if (this.index >= this.text.length) { throw this.getError(OmlParser.objectNotClosed) }
			codeUnit = this.text.charCodeAt(this.index)
			if (codeUnit !== 0x003D) { throw this.getError(OmlParser.equalSignExpected) }
			this.index++

			this.skipWhitespaceAndComments()
			const value = this.parseAny(object, key)
			object[key] = value
		}
		return object
	}

	private parseValueAsString(): string {
		const startIndex = this.index
		let codeUnit = this.text.charCodeAt(this.index)
		valueCharLoop: for (;;) {
			switch (codeUnit) {
			case 0x000A:
			case 0x0023:
			case 0x003D:
			case 0x005D:
			case 0x007D:
			case 0x0009: case 0x000B: case 0x000C: case 0x000D: case 0x0020: case 0x0085: case 0x00A0: case 0x1680: case 0x2000: case 0x2001: case 0x2002: case 0x2003: case 0x2004: case 0x2005: case 0x2006: case 0x2007: case 0x2008: case 0x2009: case 0x200A: case 0x2028: case 0x2029: case 0x202F: case 0x205F: case 0x3000:
				break valueCharLoop
			case 0x0022:
			case 0x0027:
			case 0x005B:
			case 0x007B:
				throw this.getError(OmlParser.invalidCharInValue)
			}
			if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
				this.index++
				if (codeUnit >= 0xDC00 || this.index >= this.text.length) { throw new InvalidUtf16StringError() }
				const secondCodeUnit: number = this.text.charCodeAt(this.index)
				if (!(secondCodeUnit >= 0xDC00 && secondCodeUnit <= 0xDFFF)) { throw new InvalidUtf16StringError() }
			}
			this.index++
			if (this.index >= this.text.length) { break valueCharLoop }
			codeUnit = this.text.charCodeAt(this.index)
		}
		if (startIndex === this.index) { throw this.getError(OmlParser.invalidCharInValue) }
		const value: string = this.text.substring(startIndex, this.index)
		return value
	}

	private interpretValue(value: string): any {
		if (value === "true") { return true }
		else if (value === "false") { return false }
		else if (value === "null") { return null }
		else if (value.match(/^[-+]?[0-9]+(\.[0-9]+([eE][-+]?[0-9]+)?)?$/)) {
			return Number.parseFloat(value)
		} else {
			return value
		}
	}

	private parseAny(owner: object | null, key: string | number | null): any {
		this.skipWhitespaceAndComments()
		if (this.index >= this.text.length) { throw this.getError(`Unexpected end of document`) }
		const codeUnit = this.text.charCodeAt(this.index)
		let value
		let sourceValue: string | null = null
		switch (codeUnit) {
		case 0x0022:
			value = this.parseString()
			break
		case 0x0027:
			value = this.parseChar()
			break
		case 0x005B:
			value = this.parseArray()
			break
		case 0x007B:
			value = this.parseObject()
			break
		default:
			value = this.parseValueAsString()
			sourceValue = value
			value = this.interpretValue(value)
			break
		}
		if (this.reviver !== null) {
			value = this.reviver(owner, key, value, sourceValue, this.index)
		}
		return value
	}

	private getError(message: string, offset: number = 0): OmlParserError {
		const [charIndex, lineIndex, lineCharIndex] = ReliableTxtLines.getLineInfo(this.text, this.index-offset)
		return new OmlParserError(charIndex, lineIndex, lineCharIndex, message)
	}

	parse(): any {
		const result = this.parseAny(null, null)
		this.skipWhitespaceAndComments()
		if (this.index < this.text.length) { throw this.getError(`Only one root value allowed`)}
		return result
	}
}

// ----------------------------------------------------------------------

class OmlSerializer {
	static validateWhitespaceString(str: string, onlyChar: boolean = false) {
		if (onlyChar && str.length !== 1) { throw new TypeError(`Whitespace string must be of length 1`) }
		for (let i=0; i<str.length; i++) {
			const codeUnit: number = str.charCodeAt(i)
			switch (codeUnit) {
			case 0x0009: case 0x000B: case 0x000C: case 0x000D: case 0x0020: case 0x0085: case 0x00A0: case 0x1680: case 0x2000: case 0x2001: case 0x2002: case 0x2003: case 0x2004: case 0x2005: case 0x2006: case 0x2007: case 0x2008: case 0x2009: case 0x200A: case 0x2028: case 0x2029: case 0x202F: case 0x205F: case 0x3000:
				continue
			default:
				throw new TypeError(`Invalid code unit '${codeUnit}' in whitespace string at index ${i}`)
			}
		}
	}

	private static containsSpecialChar(value: string): boolean {
		for (let i=0; i<value.length; i++) {
			const c: number = value.charCodeAt(i)
			switch (c) {
			case 0x0022:
			case 0x0023:
			case 0x0027:
			case 0x003D:
			case 0x005B: case 0x005D:
			case 0x007B: case 0x007D:
			case 0x000A:
			case 0x0009: case 0x000B: case 0x000C: case 0x000D: case 0x0020: case 0x0085: case 0x00A0: case 0x1680: case 0x2000: case 0x2001: case 0x2002: case 0x2003: case 0x2004: case 0x2005: case 0x2006: case 0x2007: case 0x2008: case 0x2009: case 0x200A: case 0x2028: case 0x2029: case 0x202F: case 0x205F: case 0x3000:
				return true
			}
			if (c >= 0xD800 && c <= 0xDFFF) {
				i++
				if (c >= 0xDC00 || i >= value.length) { throw new InvalidUtf16StringError() }
				const secondCodeUnit: number = value.charCodeAt(i)
				if (!(secondCodeUnit >= 0xDC00 && secondCodeUnit <= 0xDFFF)) { throw new InvalidUtf16StringError() }
			}
		}
		return false
	}

	static serializeString(value: string): string {
		if (value.length === 0) { 
			return `""` 
		} else if (value === "true" || value === "false" || value === "null") {
			return `"${value}"`
		} else if (this.containsSpecialChar(value)) {
			let size: number = 2
			for (let i=0; i<value.length; i++) {
				const codeUnit: number = value.charCodeAt(i)
				switch (codeUnit) {
				case 0x000A:
					size += 3
					break
				case 0x0022:
					size += 2
					break
				default:
					size++
				}
			}
			const bytes: Uint8Array = new Uint8Array(size*2)
			const view: DataView = new DataView(bytes.buffer)
			view.setUint16(0, 0x0022, false)
			let index: number = 2
			for (let i=0; i<value.length; i++) {
				const codeUnit: number = value.charCodeAt(i)
				switch (codeUnit) {
				case 0x000A:
					view.setUint16(index, 0x0022, false)
					index += 2
					view.setUint16(index, 0x002F, false)
					index += 2
					view.setUint16(index, 0x0022, false)
					index += 2
					break
				case 0x0022:
					view.setUint16(index, 0x0022, false)
					index += 2
					view.setUint16(index, 0x0022, false)
					index += 2
					break
				default:
					view.setUint16(index, codeUnit, false)
					index += 2
				}
			}
			view.setUint16(index, 0x0022, false)
			return Utf16String.fromUtf16Bytes(bytes, false, false)
		} else if (value.match(/^[-+]?[0-9]+(\.[0-9]+([eE][-+]?[0-9]+)?)?$/)) {
			return `"${value}"`
		}
		return value
	}

	static serializeValue(value: any, formatting: OmlFormatting | null, indentStr: string, replacer: ((root: any, parent: object | null, key: string | number | null, value: any, cyclic: boolean) => any) | null, rootValue: any, strings: string[], stack: object[]) {
		if (formatting !== null && formatting.maxLevel !== undefined && stack.length > formatting.maxLevel) {
			formatting = null
		}
		if (replacer !== null && stack.length === 0) {
			value = replacer(rootValue, null, null, value, false)
		}
		if (value === null) {
			strings.push("null")
		} else if (typeof value === 'string' || value instanceof String) {
			strings.push(this.serializeString(value as string))
		} else if (typeof value === 'number' || value instanceof Number) {
			if (!Number.isFinite(value)) { throw new Error(`Not allowed: "${value}"`) }
			strings.push((value as number).toString())
		} else if (typeof value === 'boolean' || value instanceof Boolean) {
			strings.push((value as boolean).toString())
		} else if (Array.isArray(value)) {
			if (stack.indexOf(value) >= 0) { throw new Error(`Cyclic`) }
			stack.push(value)
			let array = value
			if (replacer !== null) {
				array = []
				for (let i=0; i<value.length; i++) {
					const curValue = value[i]
					array.push(replacer(rootValue, value, i, curValue, curValue instanceof Object && stack.indexOf(curValue) >= 0))
				}
			}
			let isReduced = false
			if (formatting !== null && formatting.reduceSimpleArray === true) {
				let wasSimple = true
				for (let i=0; i<array.length; i++) {
					const curValue = array[i]
					if (!(curValue === null || 
						typeof curValue === 'string' || curValue instanceof String ||
						typeof curValue === 'number' || curValue instanceof Number ||
						typeof curValue === 'boolean' || curValue instanceof Boolean)) {
						wasSimple = false
						break
					}
				}
				if (wasSimple) { isReduced = true }
			}
			strings.push("[")
			let curIndentLevel = indentStr
			if (formatting !== null && !isReduced) {
				curIndentLevel += formatting.indentation
				strings.push("\n" + curIndentLevel)
			}
			for (let i=0; i<array.length; i++) {
				if (i>0) {
					if (formatting !== null && !isReduced) { strings.push("\n" + curIndentLevel) }
					else { strings.push(" ") }
				}
				const curValue = array[i]
				this.serializeValue(curValue, formatting, curIndentLevel, replacer, rootValue, strings, stack)
			}
			if (formatting !== null && !isReduced) {
				strings.push("\n" + indentStr)
			}
			stack.pop()
			strings.push("]")
		} else if (value instanceof Object) {
			if (stack.indexOf(value) >= 0) { throw new Error(`Cyclic`) }
			stack.push(value)
			if (value["toOml"] !== undefined && typeof value["toOml"] === "function") {
				const toValue = value.toOml()
				this.serializeValue(toValue, formatting, indentStr, replacer, rootValue, strings, stack)
				return
			}
			strings.push("{")
			let curIndentLevel = indentStr
			let maxLength = 0
			const entries = Object.entries(value)
			const serializedKeys = []
			const lengths = []
			for (const [key] of entries) {
				const serializedKey = this.serializeString(key)
				serializedKeys.push(serializedKey)
				if (formatting !== null && formatting.alignChar !== null) {
					const length = Utf16String.getCodePointCount(serializedKey)
					maxLength = Math.max(maxLength, length)
					lengths.push(length)
				}
			}
			if (formatting !== null) {
				curIndentLevel += formatting.indentation
				strings.push("\n" + curIndentLevel)
			}
			let isFirst = true
			for (let i=0; i<entries.length; i++) {
				const serializedKey = serializedKeys[i]
				let curValue = entries[i][1]
				if (isFirst) { isFirst = false }
				else {
					if (formatting !== null) { strings.push("\n" + curIndentLevel) }
					else { strings.push(" ") }
				}
				strings.push(serializedKey)
				if (formatting !== null) {
					if (formatting.alignChar !== null) {
						const length = lengths[i]
						const dif = maxLength - length
						if (dif > 0) {
							// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
							strings.push(formatting.alignChar!.repeat(dif))
						}
					}
					strings.push(`${formatting.beforeEqual}=${formatting.afterEqual}`)
				} else { strings.push("=") }
				if (replacer !== null) {
					curValue = replacer(rootValue, value, entries[i][0], curValue, curValue instanceof Object && stack.indexOf(curValue) >= 0)
				}
				this.serializeValue(curValue, formatting, curIndentLevel, replacer, rootValue, strings, stack)
			}
			if (formatting !== null) {
				strings.push("\n" + indentStr)
			}
			stack.pop()
			strings.push("}")
		} else {
			throw new Error(`Not allowed: "${value}"`)
		}
	}
}