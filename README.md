# setup-zb

This action sets up zb for use in GitHub Actions by:

- Downloading a zb release.
- Running the zb installer.
- Adding the zb command-line interface to the `PATH`.
- Optionally configuring zb.
- Optionally starting `zb serve`.

```yaml
- uses: actions/checkout@v7
- uses: 256lights/setup-zb@v1
- run: zb build 'zb.lua#foo'
```

## Reference

All inputs are optional.

```yaml
- uses: 256lights/setup-zb@v1
  with:
    # Version of zb to use.
    # If omitted, the latest stable release is used.
    zb-version: '0.1.0'

    # Whether to start `zb serve`. (Defaults to true.)
    # At the end of the job,
    # this action will wait up to 30 minutes for the server to finish any pending work
    # then display its logs.
    zb-serve: true

    # Additional configuration to use.
    # Reference at https://zb.256lights.llc/configuration
    configuration: >-
      {
        "trustedPublicKeys": [
          {
            "format": "ed25519",
            "publicKey": "s4dh0QI8VqQGpVkH+K1NqNSggFTqlehoXBZYdJ93IS8="
          }
        ]
      }

    # Binary cache discovery document for downloading.
    server-download-discovery: >-
      {
        "_links": {
          "https://zb-build.dev/api/rel/narinfo": [
            {"href": "https://www.example.com/{digest}.narinfo", "templated": true}
          ]
        }
      }

    # Binary cache discovery document for uploading.
    server-upload-discovery: >-
      {
        "_links": {
          "https://zb-build.dev/api/rel/nar": {"href": "https://www.example.com/{digest}.nar", "templated": true},
          "https://zb-build.dev/api/rel/narinfo": [
            {"href": "https://www.example.com/{digest}.narinfo", "templated": true}
          ]
        }
      }

    # Signing key to use in the server.
    # Store this in a GitHub Actions secret:
    # https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets
    signing-key: ${{ secrets.ZB_SIGNING_KEY }}

    # Whether to run the installer and `zb serve` as root.
    # (Defaults to true.)
    # This is generally recommended,
    # but self-hosted runners may not have root access.
    use-root: true

    # GitHub token to use to query for the zb release assets.
    # This token does not need any specific permissions
    # because it reads from public resources.
    github-token: ${{ github.token }}
```

## License

[MIT](LICENSE)
