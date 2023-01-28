/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-irregular-whitespace */
import { ReliableTxtEncoding } from "@stenway/reliabletxt"
import { Oml, OmlDocument } from "../src"

class TestClass1 {
	toOml(): string {
		return "Test Class 1"
	}
}

// ----------------------------------------------------------------------

describe("Oml.stringify", () => {
	test.each([
		[null, "null"],
		[true, "true"],
		[false, "false"],
		["null", `"null"`],
		["true", `"true"`],
		["false", `"false"`],
		["str", `str`],
		["", `""`],
		[" ", `" "`],
		["\t", `"\t"`],
		["[", `"["`],
		["]", `"]"`],
		["{", `"{"`],
		["}", `"}"`],
		["#", `"#"`],
		["=", `"="`],
		["'", `"'"`],
		["\0", `\0`],
		["\uD834\uDD1E", `𝄞`],
		["Test Test", `"Test Test"`],
		["\n", `""/""`],
		["\"", `""""`],
		["0", `"0"`],
		["0.123", `"0.123"`],
		["255.255.255.0", `255.255.255.0`],
		[0, `0`],
		[0.123, `0.123`],
		[0.0, `0`],
		[-10, `-10`],
		[10, `10`],
		[[], `[]`],
		[[10], `[10]`],
		[[10, 20], `[10 20]`],
		[{}, `{}`],
		[{test: 123}, `{test=123}`],
		[{test: 123, test2: "str"}, `{test=123 test2=str}`],
	])(
		"Given %j returns %j",
		(input, output) => {
			const stringified = Oml.stringify(input)
			expect(stringified).toEqual(output)
		}
	)

	test.each([
		[new Boolean(true), "true"],
		[new Boolean(false), "false"],
	])(
		"Given %j returns %j",
		(input, output) => {
			const stringified = Oml.stringify(input)
			expect(stringified).toEqual(output)
		}
	)

	test.each([
		["\uD800"],
		["\uD800\uD800"],
		[NaN],
		[+Infinity],
		[-Infinity],
		[undefined],
	])(
		"Given %p throws",
		(input) => {
			expect(() => Oml.stringify(input)).toThrowError()
		}
	)

	test("Cyclic throws", () => {
		const obj = {
			child: {}
		}
		const obj2 = {
			child: obj
		}
		obj.child = obj2
		expect(() => Oml.stringify(obj)).toThrowError()

		const array = [{}]
		const obj3 = {
			child: array
		}
		array.push(obj3)
		expect(() => Oml.stringify(array)).toThrowError()
	})

	test.each([
		[{}, "{\n\ttest1 = str\n}"],
		[{indentation: "  "}, "{\n  test1 = str\n}"],
		[{beforeEqual: ""}, "{\n\ttest1= str\n}"],
		[{afterEqual: ""}, "{\n\ttest1 =str\n}"],
		[{beforeEqual: "", afterEqual: ""}, "{\n\ttest1=str\n}"],
	])(
		"Given formating %j returns %j",
		(input, output) => {
			const obj = {
				test1: "str"
			}
			expect(Oml.stringify(obj, input)).toEqual(output)
		}
	)

	test.each([
		[{test1: "str", test2: [10, 20, true, null]}, {}, "{\n\ttest1 = str\n\ttest2 = [10 20 true null]\n}"],
		[{test1: "str", test2: [10, 20, true, null]}, {reduceSimpleArray: false}, "{\n\ttest1 = str\n\ttest2 = [\n\t\t10\n\t\t20\n\t\ttrue\n\t\tnull\n\t]\n}"],
		[{matrix: [[1, 0], [0, 1]]}, {}, "{\n\tmatrix = [\n\t\t[1 0]\n\t\t[0 1]\n\t]\n}"],
		[{matrix: [[1, 0], [0, 1]]}, {maxLevel: 0}, "{\n\tmatrix = [[1 0] [0 1]]\n}"],
		[{"test": true, "test 𝄞": false}, {}, `{\n\ttest     = true\n\t"test 𝄞" = false\n}`],
		[{"test": true, "test𝄞": false}, {}, `{\n\ttest  = true\n\ttest𝄞 = false\n}`],
		[{"個人情報": "田中", "日付": "２０２１－０１－０２", "エンド": true}, {alignChar: "　"}, `{\n\t個人情報 = 田中\n\t日付　　 = ２０２１－０１－０２\n\tエンド　 = true\n}`],
	])(
		"Given formating %j and %j returns %j",
		(input1, input2, output) => {
			expect(Oml.stringify(input1, input2)).toEqual(output)
		}
	)

	test.each([
		[{alignChar: "  "}],
		[{indentation: "a"}],
	])(
		"Given formating %j throws",
		(input) => {
			expect(() => Oml.stringify({}, input)).toThrowError()
		}
	)

	test("toOml", () => {
		expect(Oml.stringify(new TestClass1())).toEqual(`"Test Class 1"`)
	})

	test("Replacer Cyclic", () => {
		const obj = {
			child: {}
		}
		const obj2 = {
			child: obj
		}
		obj.child = obj2
		expect(Oml.stringify(obj, null, (root, parent, key, value, cyclic) => {
			if (cyclic) { return "<CircularReference>" }
			return value
		})).toEqual("{child={child=<CircularReference>}}")

		const array = [{}]
		const obj3 = {
			child: array
		}
		array.push(obj3)
		expect(Oml.stringify(array, null, (root, parent, key, value, cyclic) => {
			if (cyclic) { return "<CircularReference>" }
			return value
		})).toEqual("[{} {child=<CircularReference>}]")
	})

	test("Replacer Date + undefined", () => {
		const obj = {
			test1: new Date(2021, 1, 4, 12, 40),
			test2: undefined
		}
		expect(Oml.stringify(obj, null, (root, parent, key, value) => {
			if (value === undefined) { return "<Undefined>" }
			if (value instanceof Date) { return value.toISOString() }
			return value
		})).toEqual("{test1=2021-02-04T11:40:00.000Z test2=<Undefined>}")
	})
})

describe("Oml.parse", () => {
	test.each([
		[`""`, ""],
		[`""""`, "\""],
		[`""/""`, "\n"],
		[`"" `, ""],
		[`"a"`, "a"],
		[`"\uD834\uDD1E"`, `𝄞`],
		[`\n""`, ""],
		[`\n""\n`, ""],
		[`\n\n""\n\n`, ""],
		[` \n \n"" \n \n `, ""],
		[`# \n #\n"" \n \n #`, ""],
		[`'a'`, "a"],
		[`''''`, "'"],
		[`''/''`, "\n"],
		[`'\uD834\uDD1E'`, "𝄞"],
		[`'𝄞'`, "𝄞"],
		[`'a' `, "a"],
		[`[]`, []],
		[`[ ]`, []],
		[`[\n]`, []],
		[`[#test\n]`, []],
		[`["a"]`, ["a"]],
		[`[ "a" ]`, ["a"]],
		[`["a" "b"]`, ["a", "b"]],
		[`[[]]`, [[]]],
		[`[[] []]`, [[], []]],
		[`true`, true],
		[`false`, false],
		[`null`, null],
		[`True`, "True"],
		[`False`, "False"],
		[`Null`, "Null"],
		[`a`, "a"],
		[`ab`, "ab"],
		[`abc`, "abc"],
		[`a#`, "a"],
		[`𝄞`, "𝄞"],
		[`1`, 1],
		[`0`, 0],
		[`-1`, -1],
		[`1.0`, 1],
		[`1.0E-3`, 0.001],
		[`1.0E0`, 1],
		[`1.0E1`, 10],
		[`[a]`, ["a"]],
		[`[a b]`, ["a", "b"]],
		[`{}`, {}],
		[`{ }`, {}],
		[`{\n#c\n}`, {}],
		[`{ } `, {}],
		[`{a=b}`, {"a":"b"}],
		[`{abc="def"}`, {"abc":"def"}],
		[`{a=10}`, {"a":10}],
		[`{a={}}`, {"a":{}}],
		[`{a={}\nb=[]}`, {"a":{}, "b": []}],
		[`{"a"={}}`, {"a":{}}],
	])(
		"Given %j returns %j",
		(input, output) => {
			expect(Oml.parse(input)).toEqual(output)
		}
	)

	test.each([
		[``],
		[`"`],
		[`"\n`],
		[`"a\n`],
		[`""/`],
		[`""/a`],
		[`""a`],
		[`"\uDD1E"`],
		[`"\uD834\uD834"`],
		[`'`],
		[`''`],
		[`'''`],
		[`''/`],
		[`''/a`],
		[`''/'`],
		[`'\n`],
		[`'a`],
		[`'aa`],
		[`''a`],
		[`'a'a`],
		[`'\uDD1E'`],
		[`'\uD834\uD834'`],
		[`[`],
		[`[]a`],
		[`[[][]]`],
		[`[[] [][]]`],
		[`a'`],
		[`a"`],
		[`a[`],
		[`a{`],
		[`\uDD1E`],
		[`\uD834\uD834`],
		[`{`],
		[`{a`],
		[`{a=`],
		[`{a=10`],
		[`{}a`],
		[`{[`],
		[`{} {}`],
		[`{a]}`],
	])(
		"Given %j throws",
		(input) => {
			expect(() => Oml.parse(input)).toThrowError()
		}
	)

	test("Reviver", () => {
		const content = `{test="@BigInt:123" test2="Str"}`
		const result = Oml.parse(content, (owner, key, value) => {
			if (typeof value === 'string' && value.startsWith("@BigInt:")) {
				return BigInt(value.substring(8))
			}
			return value
		})
		expect(result).toEqual({test: BigInt(123), test2: "Str"})
	})
	
	test("Reviver SourceValue", () => {
		const content = `{tooBig=-9999999999999999 ok=9007199254740991}`
		const result = Oml.parse(content, (owner, key, value, source) => {
			if (typeof value === 'number' && Math.abs(value) > Number.MAX_SAFE_INTEGER) {
				return BigInt(source!)
			}
			return value
		})
		expect(result).toEqual({tooBig: BigInt("-9999999999999999"), ok: 9007199254740991})
	})
})

// ----------------------------------------------------------------------

describe("OmlDocument.parse", () => {
	test.each([
		[ReliableTxtEncoding.Utf8],
		[ReliableTxtEncoding.Utf16],
		[ReliableTxtEncoding.Utf16Reverse],
		[ReliableTxtEncoding.Utf32],
	])(
		"Given %p",
		(input) => {
			const document = OmlDocument.parse("12", null, input)
			expect(document.encoding).toEqual(input)
			expect(document.content).toEqual(12)
		}
	)

	test("No further arguments", () => {
		const document = OmlDocument.parse("{test1=1 test2=2}")
		expect(document.encoding).toEqual(ReliableTxtEncoding.Utf8)
	})
})

test("OmlDocument.constructor", () => {
	const document = new OmlDocument("abc")
	expect(document.encoding).toEqual(ReliableTxtEncoding.Utf8)
	expect(document.content).toEqual("abc")
})

test("OmlDocument.toString", () => {
	const document = OmlDocument.parse("{test1=1 test2=2}")
	expect(document.toString()).toEqual("{test1=1 test2=2}")
})

test("OmlDocument.getBytes + fromBytes", () => {
	const document = OmlDocument.parse("123")
	const bytes = document.getBytes()
	expect(bytes).toEqual(new Uint8Array([239, 187, 191, 49, 50, 51]))

	const document2 = OmlDocument.fromBytes(bytes)
	expect(document2.content).toEqual(123)
})

test("OmlDocument.getBytes + fromBytes", () => {
	const document = OmlDocument.parse("123")
	const bytes = document.getBytes()
	expect(bytes).toEqual(new Uint8Array([239, 187, 191, 49, 50, 51]))

	const document2 = OmlDocument.fromBytes(bytes)
	expect(document2.content).toEqual(123)
})

test("OmlDocument.toBase64String + fromBase64String", () => {
	const document = OmlDocument.parse("123")
	const base64str = document.toBase64String()
	expect(base64str).toEqual("Base64|77u/MTIz|")

	const document2 = OmlDocument.fromBase64String(base64str)
	expect(document2.content).toEqual(123)
})