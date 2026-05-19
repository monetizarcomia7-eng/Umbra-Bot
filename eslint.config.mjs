import { defineConfig } from "eslint/config";
import next from "eslint-config-next";

export default defineConfig([
  {
    extends: [...next],
    rules: {
      // Texto em português usa aspas naturais — escapar em JSX gera ruído sem benefício
      "react/no-unescaped-entities": "off",

      // useEffect(() => { setMounted(true) }, []) é o padrão correto para hidratação SSR
      // O novo eslint-config-next 16 marcou isso como erro mas é um falso positivo
      "react-hooks/set-state-in-effect": "off",

      // React Compiler rules — o eslint-config-next v16 as inclui como error
      // mas o código usa padrões legados (componentes inline, refs em render)
      // Manter como warn para não bloquear o build
      "react-hooks/static-components": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",

      // Estes erros são reais e devem permanecer como erro
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
]);
