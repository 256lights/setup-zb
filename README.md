# setup-zb

This action sets up zb for use in GitHub Actions by:

- Downloading a zb release.
- Running the zb installer.
- Adding the zb command-line interface to the `PATH`.
- Optionally starting `zb serve`.

```yaml
- uses: actions/checkout@v7
- uses: 256lights/setup-zb@v1
- run: zb build 'zb.lua#foo'
```

## Reference

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
