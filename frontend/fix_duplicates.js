const fs = require('fs');
const path = require('path');

// Files and their expected ending line numbers (approximate)
const files = [
  { path: 'src/components/JackpotSunburst.tsx', endPattern: /^}\s*$/, afterLine: 520 },
  { path: 'src/hooks/useVault.ts', endPattern: /^}\s*$/, afterLine: 185 },
  { path: 'src/components/SolanaConnect.tsx', endPattern: /^}\s*$/, afterLine: 270 },
  { path: 'src/config/solana.ts', endPattern: /^}\s*$/, afterLine: 110 },
  { path: 'src/components/FeatureCard.tsx', endPattern: /^}\s*$/, afterLine: 170 },
  { path: 'src/components/BaseStep.tsx', endPattern: /^}\s*$/, afterLine: 145 },
  { path: 'src/components/TechScramble.tsx', endPattern: /^}\s*$/, afterLine: 105 },
  { path: 'src/hooks/useActivator.ts', endPattern: /^}\s*$/, afterLine: 115 },
];

files.forEach(({ path: filePath, endPattern, afterLine }) => {
  const fullPath = path.join(__dirname, filePath);
  const content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n');
  
  // Find the first closing brace after the specified line
  let endIndex = -1;
  for (let i = afterLine; i < lines.length; i++) {
    if (endPattern.test(lines[i])) {
      endIndex = i;
      break;
    }
  }
  
  if (endIndex !== -1) {
    const newContent = lines.slice(0, endIndex + 1).join('\n') + '\n';
    fs.writeFileSync(fullPath, newContent);
    console.log(`✅ Fixed ${filePath} (${lines.length} → ${endIndex + 1} lines)`);
  } else {
    console.log(`❌ Could not find end pattern in ${filePath}`);
  }
});


const path = require('path');

// Files and their expected ending line numbers (approximate)
const files = [
  { path: 'src/components/JackpotSunburst.tsx', endPattern: /^}\s*$/, afterLine: 520 },
  { path: 'src/hooks/useVault.ts', endPattern: /^}\s*$/, afterLine: 185 },
  { path: 'src/components/SolanaConnect.tsx', endPattern: /^}\s*$/, afterLine: 270 },
  { path: 'src/config/solana.ts', endPattern: /^}\s*$/, afterLine: 110 },
  { path: 'src/components/FeatureCard.tsx', endPattern: /^}\s*$/, afterLine: 170 },
  { path: 'src/components/BaseStep.tsx', endPattern: /^}\s*$/, afterLine: 145 },
  { path: 'src/components/TechScramble.tsx', endPattern: /^}\s*$/, afterLine: 105 },
  { path: 'src/hooks/useActivator.ts', endPattern: /^}\s*$/, afterLine: 115 },
];

files.forEach(({ path: filePath, endPattern, afterLine }) => {
  const fullPath = path.join(__dirname, filePath);
  const content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n');
  
  // Find the first closing brace after the specified line
  let endIndex = -1;
  for (let i = afterLine; i < lines.length; i++) {
    if (endPattern.test(lines[i])) {
      endIndex = i;
      break;
    }
  }
  
  if (endIndex !== -1) {
    const newContent = lines.slice(0, endIndex + 1).join('\n') + '\n';
    fs.writeFileSync(fullPath, newContent);
    console.log(`✅ Fixed ${filePath} (${lines.length} → ${endIndex + 1} lines)`);
  } else {
    console.log(`❌ Could not find end pattern in ${filePath}`);
  }
});



