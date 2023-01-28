# OML

## About OML

OML is a format like JSON, but tries to be much more human-friendly by getting rid of commas, allowing comments, and reducing the amount of double-quotes required. Like with JSON, you have objects, arrays, strings, numbers, booleans and null, but the syntax is a bit different. See a comparison:

JSON:
```json
{
	"key1": true,
	"key2": "Hello world",
	"key3": [10, 20.5, null, false],
	"key4": {
		"sub1": "Test"
	}
}
```

OML:
```
{
	key1 = true
	key2 = "Hello world"
	key3 = [10 20.5 null false]
	key4 = {
		sub1 = Test
	}
	# this is a comment
}
```

You can see there are no commas and instead of a colon character the equal sign character is used to notate a key-value-pair. Their is also a line with a comment starting with the hash character. You can also see the string
value "Test" is not put inside of double-quotes. That's a big difference, because OML only needs the double-quotes when
the string value contains:
* Unicode whitespace
* one of the following characters: " # ' = [ ] { }

equals one of the following keywords:
* true, false, null

is empty or equals a number.

```
{
	"with whitespace" = "Hello world"
	"special characters" = ["""" "#" "'" "=" "[" "]" "{" "}"]
	"like keywords" = ["true" "false" "null"]
	empty = ""
	"like a number" = ["0" "-10" "2.5" "10.3E2"]
}
```

OML strings don't have C-like escape sequences like JSON does. Instead their is only an escape sequence for the double-quote and the line-feed character (like WSV and SML does it: https://www.whitespacesv.com / https://www.simpleml.com / https://www.npmjs.com/package/@stenway/wsv / https://www.npmjs.com/package/@stenway/sml) and for every else character just use the Unicode character itself. This is because OML tries to follow the rule: "Do it one way - don't offer multiple ways".

JSON:
```json
["Hello \"World\"", "Line1\nLine2", "\u00A5"]
```

OML:
```
["Hello ""World""" "Line1"/"Line2" ¥]
```

OML is case-sensitive like JSON. A difference to JSON on the other hand is, that OML differentiates numbers as integer and floats:

```
{
	integers = [0 +10 123 -10000]
	floats = [0.0 +10.0 1.234 10.2E-4 0.23e8]
}
```

Another difference to JSON is, that OML also has another value type, which is the value type character, where a single character ([Unicode scalar value](https://www.unicode.org/glossary/#unicode_scalar_value)) is put inside of single-quotes:

```
['a' ' ' '𝄞']
```
The representation of a single quote character or a line-feed character looks a bit funny, but it's consistent with the way the two string escape sequences work:
```
['''' ''/'']
```

When an object has duplicate keys, the behavior is strictly defined. The previous value is simply overwritten:

```
{
	key = 123
	key = 456
}
```
Here the resulting value is the number 456.

Simple values like strings, booleans, numbers and null can be the root value. It does not need to be an object or array:
```
"Simple string as root value"
```

Comments and whitespaces can be put before and after the root value:
```
# This is my copyright info
{ 
	# Here is my object data
	key = 12345
}

# -----------
# End of file
# -----------
```

An OML file is like WSV and SML a ReliableTXT file (https://www.reliabletxt.com / https://www.npmjs.com/package/@stenway/reliabletxt). So when you write a file you need to write the UTF-8 byte order mark (BOM) when using UTF-8 encoding.

See some videos for ReliableTXT here:
* [Why I like the UTF-8 Byte Order Mark (BOM)](https://www.youtube.com/watch?v=VgVkod9HQTo)
* [Stop Using Windows Line Breaks (CRLF)](https://www.youtube.com/watch?v=YPtMCiHj7F8)

## Installation

Using NPM:
```
npm install @stenway/oml
```

## Getting started

The Oml class has like the JSON object two methods: stringify and parse. You can first try out the stringify method like
this and play around with the output:

```ts
import { Oml } from '@stenway/oml'
console.log(Oml.stringify({key1: 123, key2: [true, false, null, "Hello world"]}))
```

This will output the following OML string:
```
{key1=123 key2=[true false null "Hello world"]}
```

You can make the output prettier by adding formating options. When you pass an empty object, the default formatting options apply:

```ts
const obj = {key1: 123, key2: [true, false, null, "Hello world"]}
console.log(Oml.stringify(obj, {}))
```

And you get this:

```
{
	key1 = 123
	key2 = [true false null "Hello world"]
}
```

To parse an OML string, use the parse method:

```ts
const str = `{test="Hello world" test2=null}`
console.log(Oml.parse(str))
```

## Replacing

The stringify method has a replacer functionality:

```ts
const obj = {
	test1: new Date(2021, 1, 4, 12, 40),
	test2: undefined
}
console.log(Oml.stringify(obj, {}, (root, parent, key, value) => {
	if (value === undefined) { return "<Undefined>" }
	if (value instanceof Date) { return value.toISOString() }
	return value
}))
```
Which will give you:
```
{
	test1 = 2021-02-04T11:40:00.000Z
	test2 = <Undefined>
}
```
OML does not allow the input to be NaN, +Infinity, -Infinity or undefined and will throw an error. With the replacer functionality you can avoid the thrown error by checking for such cases.

You can also react, when a circular reference was detected: 
```ts
const obj = {
	child: {}
}
const obj2 = {
	child: obj
}
obj.child = obj2
console.log(Oml.stringify(obj, null, (root, parent, key, value, cyclic) => {
	if (cyclic) { return "<CircularReference>" }
	return value
}))
```
Which will give you:
```
{child={child=<CircularReference>}}
```

If your object/class has a toOml method, you can control how the object is serialized:

```ts
class TestClass1 {
	toOml(): string {
		return "Test Class 1"
	}
}

console.log(Oml.stringify(new TestClass1()))
```
Which will give you:
```
"Test Class 1"
```

## Reviving

The parse method on the other hand has a reviver functionality:
```ts
const content = `{test="@BigInt:123" test2="Str"}`
const result = Oml.parse(content, (owner, key, value) => {
	if (typeof value === 'string' && value.startsWith("@BigInt:")) {
		return BigInt(value.substring(8))
	}
	return value
})
```
Which will give you:
```ts
{test: BigInt(123), test2: "Str"}
```

You can also get access to the original string before interpretation, to resolve problems with JavaScript precision:
```ts
const content = `{tooBig=-9999999999999999 ok=9007199254740991}`
console.log(Oml.parse(content, (owner, key, value, source) => {
	if (typeof value === 'number' && Math.abs(value) > Number.MAX_SAFE_INTEGER) {
		return BigInt(source!)
	}
	return value
}))
```

Which will give you:
```ts
{tooBig: BigInt("-9999999999999999"), ok: 9007199254740991}
```

## Formatting

You can control the formatting with the following properties: indentation, beforeEqual, afterEqual, alignChar, maxLevel, reduceSimpleArray.

For example control the used indentation whitespace sequence. The default indentation character is a tab. Here we change it to use two spaces:
```ts
console.log(Oml.stringify({key1: true, key2: "Hello world"}, {indentation: "  "}))
```
Which will give you:
```
{
  key1 = true
  key2 = "Hello world"
}
```
By specifying an empty string as indentation, you can deactivate indentation:
```ts
console.log(Oml.stringify({key1: true, key2: "Hello world"}, {indentation: ""}))
```
Which will give you:
```
{
key1 = true
key2 = "Hello world"
}
```

Another example is, that you can control the maximum depth level where formatting should be applied:
```ts
console.log(Oml.stringify({matrix: [[1, 0], [0, 1]]}, {maxLevel: 1}))
```
Which will give you:
```
{
	matrix = [
		[1 0]
		[0 1]
	]
}
```

Or align your keys with another whitespace character:
```ts
console.log(Oml.stringify(
	{"個人情報": "田中", "日付": "２０２１－０１－０２", "エンド": true},
	{alignChar: "\u3000"}
))
```
Which will give you:
```
{
	個人情報 = 田中
	日付　　 = ２０２１－０１－０２
	エンド　 = true
}
```

## Document class

The OmlDocument class offers easy methods to convert your document to bytes or back from bytes by combining your data with
the ReliableTxtEncoding property from the [@stenway/reliabletxt](https://www.npmjs.com/package/@stenway/reliabletxt) package:

```ts
const document = new OmlDocument({test: true, test2: "Hello world"}, ReliableTxtEncoding.Utf8)
const omlStr = document.toString()
const bytes = document.getBytes()

const document2 = OmlDocument.fromBytes(bytes)
```

And of course you can easily convert your document to a Reliable Base64 string and back:
```ts
const document = new OmlDocument({test: true, test2: "Hello world"}, ReliableTxtEncoding.Utf8)
const base64Str = document.toBase64String()
console.log(base64Str)

const document2 = OmlDocument.fromBase64String(base64Str)
```
With the Reliable Base64 string being:
```
Base64|77u/e3Rlc3Q9dHJ1ZSB0ZXN0Mj0iSGVsbG8gd29ybGQifQ|
```

## File IO

For file reading and writing functionality see the [oml-io package](https://www.npmjs.com/package/@stenway/oml-io).

## Comparison to JSON
OML creates in the most common cases smaller files than JSON, because it uses less double-quotes:
```ts
const obj = {
	key1: 123,
	key2: true,
	key3: "Hello world",
	key4: null,
	key5: [0, 10, 20],
	key6: {
		width: 1920,
		height: 1080
	}
}

console.log(JSON.stringify(obj))
console.log(Oml.stringify(obj))
```
Compare the results:
```
{"key1":123,"key2":true,"key3":"Hello world","key4":null,"key5":[0,10,20],"key6":{"width":1920,"height":1080}}
{key1=123 key2=true key3="Hello world" key4=null key5=[0 10 20] key6={width=1920 height=1080}}
```

