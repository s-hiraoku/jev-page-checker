# pending GitHub Actions

このディレクトリは退避用です。`.github/workflows/` への push には Workflows write が要るため、中身はまだ有効な workflow ではありません。

有効化:

1. `ci/pending-workflows/ci.yml` を `.github/workflows/ci.yml` へ移す
2. `ci/pending-workflows/pages.yml` を `.github/workflows/pages.yml` へ移す
3. このディレクトリを消す
4. `GH_TOKEN`（Workflows write 付き）で push する

`v*` タグ、または `workflow_dispatch` の `release_tag=v0.0.1` で、ストア提出用 zip が GitHub Release に付きます。
