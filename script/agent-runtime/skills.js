const fs = require('fs');
const path = require('path');

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/;

function parseYamlFrontmatter(frontmatter) {
  const data = {};
  const lines = frontmatter.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    let value = match[2].trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    data[key] = value;
  }

  return data;
}

function parseSkillFrontmatter(content, filePath) {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) {
    return null;
  }

  const yamlData = parseYamlFrontmatter(match[1]);
  const skillDir = path.resolve(path.dirname(filePath));
  const name = yamlData.name || path.basename(skillDir);
  const description = yamlData.description || '';

  return {
    name,
    description,
    path: skillDir,
  };
}

function walkForSkills(dir, skills) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkForSkills(fullPath, skills);
      continue;
    }

    if (entry.isFile() && entry.name === 'SKILL.md') {
      const content = fs.readFileSync(fullPath, 'utf8');
      const skill = parseSkillFrontmatter(content, fullPath);
      if (skill) {
        skills.push(skill);
      }
    }
  }
}

function discoverSkills(directories) {
  const skills = [];
  const uniqueDirs = Array.from(new Set(directories.map((dir) => path.resolve(dir))));

  for (const dir of uniqueDirs) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      continue;
    }

    walkForSkills(dir, skills);
  }

  return skills;
}

function getConfiguredSkillDirectories() {
  const configured = process.env.SKILL_DIRECTORIES || process.env.SKILL_DIRS;
  if (!configured) {
    return [];
  }

  return configured
    .split(',')
    .map((dir) => dir.trim())
    .filter(Boolean);
}

module.exports = {
  discoverSkills,
  getConfiguredSkillDirectories,
  parseSkillFrontmatter,
  parseYamlFrontmatter,
};
