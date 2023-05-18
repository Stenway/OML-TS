/* eslint-disable no-console */
import { Oml } from "../src/oml.js";
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
};
console.log("JSON: " + JSON.stringify(obj));
console.log("OML:  " + Oml.stringify(obj));
//# sourceMappingURL=dev.js.map