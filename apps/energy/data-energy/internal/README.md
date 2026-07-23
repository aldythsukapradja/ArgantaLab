# Internal OSDU landing

Place protected source material outside `public/`. The supported interchange file is
`osdu-input.json` with this minimal shape:

```json
{
  "records": [{
    "id": "volve-interpretation-001",
    "name": "Volve internal interpretation",
    "type": "FieldInterpretation",
    "category": "work-product-component",
    "dataNature": "interpreted",
    "data": {}
  }]
}
```

The builder forces every record from this lane to `arganta:internal` LegalTags and
internal owners/viewers ACL groups. It emits a separate manifest and never copies
internal source files into `public/`.
