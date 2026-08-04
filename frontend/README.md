# React + TypeScript + Vite

Vite 上で React を動かすための最小構成テンプレートです。HMR（ホットモジュールリプレースメント）といくつかの ESLint ルールが含まれています。

現在、公式プラグインが 2 種類あります。

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) — [Oxc](https://oxc.rs) を使用
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) — [SWC](https://swc.rs/) を使用

## React Compiler

このテンプレートでは、開発・ビルド時のパフォーマンスへの影響を考慮して React Compiler を有効にしていません。導入する場合は[こちらのドキュメント](https://react.dev/learn/react-compiler/installation)を参照してください。

## ESLint 設定の拡張

本番アプリケーションを開発する場合は、型情報を利用する Lint ルールを有効にすることをお勧めします。

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // その他の設定...

      // tseslint.configs.recommended を以下に置き換え
      tseslint.configs.recommendedTypeChecked,
      // より厳格なルールを使いたい場合はこちら
      tseslint.configs.strictTypeChecked,
      // スタイル関連のルールを追加したい場合はこちら
      tseslint.configs.stylisticTypeChecked,

      // その他の設定...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // その他のオプション...
    },
  },
])
```

React 専用の Lint ルールとして [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) と [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) をインストールすることもできます。

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // その他の設定...
      // React 向け Lint ルールを有効化
      reactX.configs['recommended-typescript'],
      // React DOM 向け Lint ルールを有効化
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // その他のオプション...
    },
  },
])
```
