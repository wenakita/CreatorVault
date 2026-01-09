const { buildSystemPrompt } = require('./system-prompt');
const { getSkillMetadata, initializeSkillCache } = require('./skills-cache');

initializeSkillCache();

module.exports = {
  buildSystemPrompt,
  getSkillMetadata,
  initializeSkillCache,
};
