const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const {
  discoverSkills,
  parseSkillFrontmatter,
  parseYamlFrontmatter,
} = require('../skills');

test('parseYamlFrontmatter extracts name and description', () => {
  const yaml = [
    'name: "Chain Data"',
    'description: Fetches onchain data',
    'ignored: true',
  ].join('\n');

  const parsed = parseYamlFrontmatter(yaml);

  assert.deepStrictEqual(parsed, {
    name: 'Chain Data',
    description: 'Fetches onchain data',
    ignored: 'true',
  });
});

test('parseSkillFrontmatter returns skill metadata with absolute path', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-parse-'));
  const skillFile = path.join(tempDir, 'SKILL.md');
  const content = [
    '---',
    'name: "Wallet Insights"',
    'description: Tracks wallet activity',
    '---',
    '\n',
    '# Body',
  ].join('\n');

  fs.writeFileSync(skillFile, content, 'utf8');

  const parsed = parseSkillFrontmatter(content, skillFile);

  assert.ok(parsed);
  assert.strictEqual(parsed.name, 'Wallet Insights');
  assert.strictEqual(parsed.description, 'Tracks wallet activity');
  assert.ok(path.isAbsolute(parsed.path));
  assert.strictEqual(parsed.path, tempDir);
});

test('discoverSkills finds SKILL.md files with frontmatter', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-discover-'));
  const nestedDir = path.join(baseDir, 'agents', 'analytics');
  fs.mkdirSync(nestedDir, { recursive: true });

  fs.writeFileSync(
    path.join(baseDir, 'SKILL.md'),
    ['---', 'name: Root Skill', 'description: Root', '---'].join('\n'),
    'utf8'
  );

  fs.writeFileSync(
    path.join(nestedDir, 'SKILL.md'),
    ['---', 'name: Nested Skill', 'description: Nested', '---'].join('\n'),
    'utf8'
  );

  fs.writeFileSync(
    path.join(baseDir, 'README.md'),
    '# Not a skill',
    'utf8'
  );

  const skills = discoverSkills([baseDir]);

  assert.strictEqual(skills.length, 2);
  for (const skill of skills) {
    assert.ok(path.isAbsolute(skill.path));
  }
});
