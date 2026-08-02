import { useCallback, useState } from "react"
import { Light as SyntaxHighlighter } from "react-syntax-highlighter"
import atomOneDark from "react-syntax-highlighter/dist/esm/styles/hljs/atom-one-dark"
import goLang from "react-syntax-highlighter/dist/esm/languages/hljs/go"
import pythonLang from "react-syntax-highlighter/dist/esm/languages/hljs/python"
import typescriptLang from "react-syntax-highlighter/dist/esm/languages/hljs/typescript"
import javascriptLang from "react-syntax-highlighter/dist/esm/languages/hljs/javascript"
import rustLang from "react-syntax-highlighter/dist/esm/languages/hljs/rust"
import javaLang from "react-syntax-highlighter/dist/esm/languages/hljs/java"
import csharpLang from "react-syntax-highlighter/dist/esm/languages/hljs/csharp"
import cLang from "react-syntax-highlighter/dist/esm/languages/hljs/c"
import cppLang from "react-syntax-highlighter/dist/esm/languages/hljs/cpp"
import jsonLang from "react-syntax-highlighter/dist/esm/languages/hljs/json"
import yamlLang from "react-syntax-highlighter/dist/esm/languages/hljs/yaml"
import markdownLang from "react-syntax-highlighter/dist/esm/languages/hljs/markdown"
import bashLang from "react-syntax-highlighter/dist/esm/languages/hljs/bash"
import sqlLang from "react-syntax-highlighter/dist/esm/languages/hljs/sql"
import cssLang from "react-syntax-highlighter/dist/esm/languages/hljs/css"
import xmlLang from "react-syntax-highlighter/dist/esm/languages/hljs/xml"
import phpLang from "react-syntax-highlighter/dist/esm/languages/hljs/php"
import rubyLang from "react-syntax-highlighter/dist/esm/languages/hljs/ruby"
import swiftLang from "react-syntax-highlighter/dist/esm/languages/hljs/swift"
import kotlinLang from "react-syntax-highlighter/dist/esm/languages/hljs/kotlin"
import scalaLang from "react-syntax-highlighter/dist/esm/languages/hljs/scala"
import dartLang from "react-syntax-highlighter/dist/esm/languages/hljs/dart"
import luaLang from "react-syntax-highlighter/dist/esm/languages/hljs/lua"
import haskellLang from "react-syntax-highlighter/dist/esm/languages/hljs/haskell"
import elixirLang from "react-syntax-highlighter/dist/esm/languages/hljs/elixir"
import clojureLang from "react-syntax-highlighter/dist/esm/languages/hljs/clojure"
import erlangLang from "react-syntax-highlighter/dist/esm/languages/hljs/erlang"
import juliaLang from "react-syntax-highlighter/dist/esm/languages/hljs/julia"
import ocamlLang from "react-syntax-highlighter/dist/esm/languages/hljs/ocaml"
import fsharpLang from "react-syntax-highlighter/dist/esm/languages/hljs/fsharp"
import rLang from "react-syntax-highlighter/dist/esm/languages/hljs/r"
import makefileLang from "react-syntax-highlighter/dist/esm/languages/hljs/makefile"
import nixLang from "react-syntax-highlighter/dist/esm/languages/hljs/nix"
import diffLang from "react-syntax-highlighter/dist/esm/languages/hljs/diff"
import plaintextLang from "react-syntax-highlighter/dist/esm/languages/hljs/plaintext"
import { Check, Copy } from "lucide-react"

SyntaxHighlighter.registerLanguage("go", goLang)
SyntaxHighlighter.registerLanguage("python", pythonLang)
SyntaxHighlighter.registerLanguage("py", pythonLang)
SyntaxHighlighter.registerLanguage("typescript", typescriptLang)
SyntaxHighlighter.registerLanguage("ts", typescriptLang)
SyntaxHighlighter.registerLanguage("typescriptreact", typescriptLang)
SyntaxHighlighter.registerLanguage("tsx", typescriptLang)
SyntaxHighlighter.registerLanguage("javascript", javascriptLang)
SyntaxHighlighter.registerLanguage("js", javascriptLang)
SyntaxHighlighter.registerLanguage("javascriptreact", javascriptLang)
SyntaxHighlighter.registerLanguage("jsx", javascriptLang)
SyntaxHighlighter.registerLanguage("rust", rustLang)
SyntaxHighlighter.registerLanguage("rs", rustLang)
SyntaxHighlighter.registerLanguage("java", javaLang)
SyntaxHighlighter.registerLanguage("csharp", csharpLang)
SyntaxHighlighter.registerLanguage("cs", csharpLang)
SyntaxHighlighter.registerLanguage("c", cLang)
SyntaxHighlighter.registerLanguage("cpp", cppLang)
SyntaxHighlighter.registerLanguage("cxx", cppLang)
SyntaxHighlighter.registerLanguage("json", jsonLang)
SyntaxHighlighter.registerLanguage("yaml", yamlLang)
SyntaxHighlighter.registerLanguage("yml", yamlLang)
SyntaxHighlighter.registerLanguage("markdown", markdownLang)
SyntaxHighlighter.registerLanguage("md", markdownLang)
SyntaxHighlighter.registerLanguage("bash", bashLang)
SyntaxHighlighter.registerLanguage("sh", bashLang)
SyntaxHighlighter.registerLanguage("shell", bashLang)
SyntaxHighlighter.registerLanguage("sql", sqlLang)
SyntaxHighlighter.registerLanguage("css", cssLang)
SyntaxHighlighter.registerLanguage("html", xmlLang)
SyntaxHighlighter.registerLanguage("xml", xmlLang)
SyntaxHighlighter.registerLanguage("svg", xmlLang)
SyntaxHighlighter.registerLanguage("php", phpLang)
SyntaxHighlighter.registerLanguage("ruby", rubyLang)
SyntaxHighlighter.registerLanguage("rb", rubyLang)
SyntaxHighlighter.registerLanguage("swift", swiftLang)
SyntaxHighlighter.registerLanguage("kotlin", kotlinLang)
SyntaxHighlighter.registerLanguage("kt", kotlinLang)
SyntaxHighlighter.registerLanguage("scala", scalaLang)
SyntaxHighlighter.registerLanguage("dart", dartLang)
SyntaxHighlighter.registerLanguage("lua", luaLang)
SyntaxHighlighter.registerLanguage("haskell", haskellLang)
SyntaxHighlighter.registerLanguage("hs", haskellLang)
SyntaxHighlighter.registerLanguage("elixir", elixirLang)
SyntaxHighlighter.registerLanguage("ex", elixirLang)
SyntaxHighlighter.registerLanguage("clojure", clojureLang)
SyntaxHighlighter.registerLanguage("clj", clojureLang)
SyntaxHighlighter.registerLanguage("erlang", erlangLang)
SyntaxHighlighter.registerLanguage("erl", erlangLang)
SyntaxHighlighter.registerLanguage("julia", juliaLang)
SyntaxHighlighter.registerLanguage("jl", juliaLang)
SyntaxHighlighter.registerLanguage("ocaml", ocamlLang)
SyntaxHighlighter.registerLanguage("ml", ocamlLang)
SyntaxHighlighter.registerLanguage("fsharp", fsharpLang)
SyntaxHighlighter.registerLanguage("fs", fsharpLang)
SyntaxHighlighter.registerLanguage("r", rLang)
SyntaxHighlighter.registerLanguage("makefile", makefileLang)
SyntaxHighlighter.registerLanguage("nix", nixLang)
SyntaxHighlighter.registerLanguage("diff", diffLang)
SyntaxHighlighter.registerLanguage("patch", diffLang)
SyntaxHighlighter.registerLanguage("plaintext", plaintextLang)
SyntaxHighlighter.registerLanguage("text", plaintextLang)
SyntaxHighlighter.registerLanguage("none", plaintextLang)

interface CodeBlockProps {
  language?: string
  value: string
}

const LANG_ALIASES: Record<string, string> = {
  objectivec: "objectivec",
  "objective-c": "objectivec",
  shellscript: "bash",
  hcl: "bash",
  tf: "bash",
  toml: "bash",
  plaintext: "plaintext",
  text: "plaintext",
  none: "plaintext",
}

export function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = useCallback(() => {
    void navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => { setCopied(false) }, 2000)
  }, [value])

  const lang = language ? (LANG_ALIASES[language] ?? language) : "plaintext"
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const displayLang = language || "text"
  const trimmed = value.endsWith("\n") ? value.slice(0, -1) : value

  return (
    <div className="relative group my-2">
      <div className="flex items-center justify-between px-3 py-1 bg-[#161b22] border border-[#30363d] border-b-0 rounded-t-md">
        <span className="text-xs font-mono text-[#8b949e]">{displayLang}</span>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1 text-xs text-[#8b949e] hover:text-[#c9d1d9] transition-colors"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <SyntaxHighlighter
        language={lang}
        style={atomOneDark}
        customStyle={{
          margin: 0,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: "0.375rem",
          borderBottomRightRadius: "0.375rem",
          border: "1px solid #30363d",
          borderTop: "none",
          fontSize: "0.8125rem",
          lineHeight: "1.5",
          padding: "0.75rem 1rem",
        }}
        codeTagProps={{
          style: {
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          },
        }}
      >
        {trimmed}
      </SyntaxHighlighter>
    </div>
  )
}
