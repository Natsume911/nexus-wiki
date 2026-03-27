import { all, createLowlight } from 'lowlight';

export const lowlight = createLowlight(all);

// Language list for the UI dropdown selector (most common/useful ones)
export const LANGUAGES = [
  // Web
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'less', label: 'Less' },
  { value: 'json', label: 'JSON' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'xml', label: 'XML' },

  // Systems & general purpose
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'scala', label: 'Scala' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'swift', label: 'Swift' },
  { value: 'objectivec', label: 'Objective-C' },
  { value: 'dart', label: 'Dart' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'perl', label: 'Perl' },
  { value: 'lua', label: 'Lua' },
  { value: 'r', label: 'R' },
  { value: 'julia', label: 'Julia' },
  { value: 'elixir', label: 'Elixir' },
  { value: 'erlang', label: 'Erlang' },
  { value: 'haskell', label: 'Haskell' },
  { value: 'clojure', label: 'Clojure' },
  { value: 'fsharp', label: 'F#' },

  // Shell & scripting
  { value: 'bash', label: 'Bash' },
  { value: 'shell', label: 'Shell' },
  { value: 'powershell', label: 'PowerShell' },

  // Data & query
  { value: 'sql', label: 'SQL' },
  { value: 'pgsql', label: 'PostgreSQL' },

  // Config & DevOps
  { value: 'yaml', label: 'YAML' },
  { value: 'toml', label: 'TOML' },
  { value: 'ini', label: 'INI' },
  { value: 'dockerfile', label: 'Dockerfile' },
  { value: 'nginx', label: 'Nginx' },
  { value: 'apache', label: 'Apache' },
  { value: 'makefile', label: 'Makefile' },
  { value: 'cmake', label: 'CMake' },
  { value: 'properties', label: 'Properties' },

  // Markup & docs
  { value: 'markdown', label: 'Markdown' },
  { value: 'latex', label: 'LaTeX' },

  // Other
  { value: 'diff', label: 'Diff' },
  { value: 'protobuf', label: 'Protobuf' },
  { value: 'wasm', label: 'WebAssembly' },
  { value: 'vbnet', label: 'VB.NET' },
  { value: 'groovy', label: 'Groovy' },
  { value: 'plaintext', label: 'Testo semplice' },
] as const;
