# Serialization

Files are grouped by the values they serialize and the work they perform.

```text
serialization/
├── Serializer.js          type dispatch for the existing toJson/fromJson API
├── customGateParsing.js   user-entered Forge matrices, rotations and circuit ranges
├── numeric/
│   └── values.js          packed complex and matrix strings
├── gates/
│   ├── gate.js            gate JSON, circuit-backed gates and parse-error recovery
│   ├── properties.js      gate identifiers, symbols, names and arguments
│   ├── matrix.js          matrix validation and gate construction
│   └── collections.js     gate columns and ordered custom-gate definitions
└── circuits/
    ├── circuit.js         circuit structure and displayed-wire padding
    ├── initialState.js    sparse initial-state values
    ├── registers.js       named registers, inputs and value labels
    └── text.js            JSON text parsing and the last successful result
```

`Serializer.toJson(value, context)` dispatches by value type;
`Serializer.fromJson(expectedType, json, context)` dispatches by the requested type.
Type-specific modules implement the conversions. Callers of
`fromJsonText_CircuitDefinition` import `circuits/text.js` directly. Its cache changes
only after both JSON parsing and circuit construction succeed: repeated invalid input
must keep throwing, never return an older circuit.

Gates can contain circuits and circuits contain gates. The conversion functions are
declarations called after module initialization, so their recursive imports do not need
a mutable registry or startup configuration. Custom-gate definitions are read and written
in order, with each definition able to refer to preceding definitions.

Keep packed numeric strings, gate ids and arguments, register labels, sparse initial
states and the existing circuit JSON representation unchanged. The gate reader deliberately
recovers unsupported gate definitions as disabled Parse Error gates and preserves their
original JSON. Strict take imports separately reject any circuit that changes during
that round trip; recovery here must not replace that validation.

`test/serialization/Serializer.test.js` covers the public API and nested custom-gate
round trips. `test/serialization/circuits/text.test.js` covers successful caching and
repeated syntax/structure failures. Run `npm run check` for lint, unused-code checks,
browser tests, end-to-end tests and performance tests.
