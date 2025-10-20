# Cross-Platform Path Handling Guide

This guide describes the cross-platform path handling solution implemented in the `@elysiajs/openapi` project to resolve path compatibility issues between Windows/Linux/macOS systems.

## Problem Statement

During development, we encountered the following common path-related issues:

1. **Windows Permission Issues**: On Windows systems, temporary files may be locked by other processes, causing deletion failures
2. **Inconsistent Path Separators**: Windows uses backslashes `\` while Unix systems use forward slashes `/`
3. **TypeScript Compilation Path Issues**: TypeScript CLI requires Unix-format paths in certain scenarios
4. **Temporary Directory Locations**: Different systems have different access permissions for temporary directories
5. **Path Comparison and Normalization**: Path comparison can be error-prone in cross-platform environments

## Solution

### PathUtils Utility Class

We created a comprehensive `PathUtils` utility class (`src/utils/path.ts`) to handle all cross-platform path issues.

#### Key Features

```typescript
import { PathUtils } from './utils/path'

// 1. Path normalization - Convert paths to current system standard format
PathUtils.normalize('C:\\Users\\file.txt') // Windows: C:\Users\file.txt
PathUtils.normalize('/home/user/file.txt') // Unix: /home/user/file.txt

// 2. Path format conversion
PathUtils.toUnix('C:\\Users\\file.txt')    // -> C:/Users/file.txt
PathUtils.toWindows('/home/user/file.txt') // -> \home\user\file.txt

// 3. Smart path joining
PathUtils.join('src', 'components', 'Button', 'index.tsx')
// -> 'src\components\Button\index.tsx' (Windows)
// -> 'src/components/Button/index.tsx' (Unix)

// 4. Cross-platform temporary directory
PathUtils.getTempDir('elysia-openapi')
// -> Windows: project-root/node_modules/.cache/elysia-openapi
// -> Unix: /tmp/elysia-openapi

// 5. Safe file removal (handles Windows locking issues)
PathUtils.safeRemove(tempDir, 3, 100) // Retry 3 times with 100ms delay

// 6. Path comparison (cross-platform)
PathUtils.equals('./src/index.ts', 'src/index.ts') // true

// 7. Path debugging
PathUtils.debug('/path/to/file')
/*
{
  original: '/path/to/file',
  normalized: '/path/to/file',
  unix: '/path/to/file',
  windows: '\\path\\to\\file',
  isAbsolute: true,
  exists: false,
  platform: 'win32'
}
*/
```

### Application in gen/index.ts

The original simple `join` function was replaced with the full functionality of `PathUtils`:

```typescript
// Old approach
const join = (...parts: string[]) => {
    const normalized = parts
        .map(part => part.replace(/\\/g, '/'))
        .filter(part => part && part !== '/')
        .join('/')
        .replace(/\/{2,}/g, '/')
    // ... simple absolute path handling
}

// New approach
import { PathUtils } from '../utils/path'
const join = PathUtils.join.bind(PathUtils)
```

#### Key Improvements

1. **Temporary Directory Handling**:
   ```typescript
   // Old approach: Simple platform detection
   if (process.platform === 'win32') {
       tmpRoot = join(projectRoot, 'node_modules/.cache/.ElysiaAutoOpenAPI')
   } else {
       tmpRoot = join(os.tmpdir(), '.ElysiaAutoOpenAPI')
   }

   // New approach: Use dedicated method
   tmpRoot = PathUtils.getTempDir('.ElysiaAutoOpenAPI')
   ```

2. **File Removal**:
   ```typescript
   // Old approach: Could cause EBUSY errors
   fs.rmSync(tmpRoot, { recursive: true, force: true })

   // New approach: Safe retry mechanism
   PathUtils.safeRemove(tmpRoot, 3, 100)
   ```

3. **TypeScript Path Handling**:
   ```typescript
   // Old approach: Manual platform checking
   if (process.platform === 'win32') {
       extendsRef = extendsRef.replace(/\\/g, '/')
       src = src.replace(/\\/g, '/')
       distDir = distDir.replace(/\\/g, '/')
   }

   // New approach: Smart conversion
   extendsRef = PathUtils.toUnix(extendsRef)
   src = PathUtils.toUnix(src)
   distDir = PathUtils.toUnix(distDir)
   ```

## Best Practices

### 1. Using PathUtils in Your Project

```typescript
import { PathUtils } from './utils/path'

// ✅ Recommended: Use PathUtils methods
const configPath = PathUtils.join(process.cwd(), 'config', 'app.json')
const tempDir = PathUtils.getTempDir('my-app')

// ❌ Avoid: Direct string concatenation
const configPath = process.cwd() + '/config/app.json'
```

### 2. Handling User-Input Paths

```typescript
function handleUserPath(userPath: string) {
    // Normalize user input
    const normalized = PathUtils.normalize(userPath)

    // Convert to absolute path
    const absolute = PathUtils.isAbsolute(normalized)
        ? normalized
        : PathUtils.join(process.cwd(), normalized)

    return absolute
}
```

### 3. Paths in TypeScript Configuration

```typescript
// When generating temporary tsconfig
const tempTsConfig = {
    extends: PathUtils.toUnix(originalTsConfigPath), // Ensure Unix format
    compilerOptions: {
        outDir: PathUtils.toUnix(outputDirectory)
    }
}
```

### 4. Error Handling

```typescript
import { PathUtils } from './utils/path'

try {
    PathUtils.safeRemove(tempDirectory)
} catch (error) {
    if (error.code === 'EBUSY' || error.code === 'EPERM') {
        console.warn('File is busy, retry later')
        // Can implement retry logic or notify user
    }
    throw error
}
```

## Platform-Specific Notes

### Windows
- Temporary files may be locked by antivirus software or editors
- Path length limit (260 characters)
- Need to handle network paths (`\\server\share`)
- Permission issues are more common

### macOS/Linux
- Paths are case-sensitive
- Support Unicode filenames
- Temporary directories usually have more relaxed permissions
- Symbolic link handling

### General Recommendations
1. Always use `PathUtils` for path handling
2. Avoid hardcoding path separators
3. Be careful with working directory when using relative paths
4. Prefer Unix format for internal processing in cross-platform code

## Testing

Run example code to test path handling functionality:

```bash
# Run path examples (requires ts-node or compile first)
npx ts-node src/utils/path-examples.ts

# Or run compiled version
node dist/cjs/utils/path-examples.js
```

## Troubleshooting

### Common Issues

1. **EBUSY: resource busy or locked**
   - Use `PathUtils.safeRemove()` instead of `fs.rmSync()`
   - Increase retry count and delay

2. **Module not found path errors**
   - Use `PathUtils.join()` to construct paths
   - Check if paths use correct separators

3. **TypeScript compilation errors**
   - Use `PathUtils.toUnix()` to convert paths passed to TypeScript CLI
   - Ensure temporary tsconfig uses correct path format

### Debugging Tips

```typescript
// Use PathUtils.debug() to get detailed path information
const debugInfo = PathUtils.debug(somePath)
console.table(debugInfo)
```

This solution ensures that `@elysiajs/openapi` works stably on all major operating systems, especially in complex monorepo environments.