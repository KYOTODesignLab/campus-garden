# Campus Garden — XR Field Record

キャンパス内の庭を「時間をまたいで観察した記録」として見せる Web ページです。
点群スキャン・HoloLens による AR オーバーレイ・環境センシングを一枚のサイトにまとめています。
画像もコード内に埋め込んでいるので、`index.html` 1 ファイルだけで動きます。

## 開き方

`index.html` をブラウザ（Chrome / Edge / Safari いずれも可）で開くだけです。
3D ビューワーのライブラリ（Three.js）と書体を CDN から読み込むため、**閲覧時はインターネット接続が必要**です。

Web に公開してリンクで共有する場合は、リポジトリに `index.html` を置き、
GitHub の Settings → Pages を有効化すると `https://<user>.github.io/<repo>/` で公開されます。

## 構成（5 セクション）

- **Index** — 庭の物理写真と AR 点群オーバーレイを、ドラッグするスライダーで比較
- **Photo** — 現地での AR セッションの記録写真
- **Data** — 環境センシング（気温・湿度・照度・スペクトル）を 5 地点で時系列比較
- **About** — プロジェクトの趣旨と手法（M3C2 差分など）
- **3D** — before / after / 差分（M3C2）の点群を自由視点で閲覧

## 実データへの差し替え箇所

現在はサンプルデータで動いています。本番データに差し替える場所は次の通りです。

- **Before/After**：`<canvas id="cv-ar">` に描いている AR オーバーレイを、実際の AR レンダー画像か動画に置き換え
- **Data（センサー）**：スクリプト内の `temp / humid / lux / spec` 配列を実測ログに差し替え（CSV の場合は読み込み処理を追加）。軸・凡例・ツールチップは渡した値域に自動で追従します
- **3D 点群**：CloudCompare から `.ply`（バイナリ、M3C2 距離をスカラー／カラー値として保持）で書き出し、Three.js の `PLYLoader` で読み込み。カメラ・レイヤー切替・凡例は 3 メッシュ前提で実装済み

## 配色の決まり

- インターフェース系（ナビ・スライダーのつまみなど）＝シアン／マゼンタの色収差モチーフ
- 計測データ系（差分・センサー）＝ M3C2 の符号付き距離ランプ（青＝後退 / 白＝不変 / 赤＝増加）

を役割で分けています。

## 3D viewer (added)

The "3D" section now embeds a real COPC point-cloud viewer (`3d/`) instead of
the generated stand-in, via an iframe (`<iframe src="./3d/">` in the 3D
section of `index.html`).

### Structure

- `3d-viewer/` — the viewer's **source code** (Vite project). This is what
  you edit and collaborate on.
- `3d/` — the **built output** of `3d-viewer/`, committed as static files and
  actually served at `https://kyotodesignlab.github.io/campus-garden/3d/`.
  Do not edit files in here directly — they get overwritten on the next
  build.

### Working on the viewer

```bash
cd 3d-viewer
npm install
npm run dev        # local dev server with hot reload
```

### Publishing changes

This repo has no build step / CI — GitHub Pages serves the committed files
as-is (per the existing README above). So after editing `3d-viewer/`, build
it and commit the refreshed output:

```bash
cd 3d-viewer
npm run build       # writes into ../3d
cd ..
git add 3d 3d-viewer
git commit -m "Update 3D viewer"
git push
```

### Data

Point cloud datasets are listed in `3d-viewer/public/data/manifest.json`
(also copied into the built `3d/data/manifest.json` — edit the source, not
the build output). See `3d-viewer/public/data/README.txt` and
`3d-viewer/README.md` for the manifest format, dataset hosting (e.g.
Cloudflare R2), and CORS requirements.
