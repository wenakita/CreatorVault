const { getSkillMetadata } = require('./skills-cache');

function formatSkillSummary(skill) {
  const description = skill.description ? ` - ${skill.description}` : '';
  return `- ${skill.name}${description} (${skill.path})`;
}

function buildSystemPrompt(basePrompt = '') {
  const skills = getSkillMetadata();
  if (!skills.length) {
    return basePrompt;
  }

  const summary = skills.map(formatSkillSummary).join('\n');
  const skillsBlock = `\n\nAvailable Skills:\n${summary}`;

  return `${basePrompt}${skillsBlock}`.trim();
}

module.exports = {
  buildSystemPrompt,
};
