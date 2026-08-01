# setup-zb

This action sets up zb for use in GitHub Actions by
downloading and installing a version of zb and adding it to the `PATH`.

```yaml
- uses: actions/checkout@v7
- uses: 256lights/setup-zb@v0.1.0
- run: zb build 'zb.lua#foo'
```

## Reference

```yaml
- uses: 256lights/setup-zb@v0.1.0
  with:
    # Version of zb to use.
    # If omitted, the latest stable release is used.
    zb-version: '0.1.0'

    # GitHub token to use to query for the zb release assets.
    github-token: ${{ github.token }}
```

## License

[MIT](LICENSE)
