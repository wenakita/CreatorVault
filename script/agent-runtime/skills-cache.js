const { discoverSkills, getConfiguredSkillDirectories } = require('./skills');

let cachedSkills = null;

function initializeSkillCache() {
  const directories = getConfiguredSkillDirectories();
  cachedSkills = discoverSkills(directories);
  return cachedSkills;
}

function getSkillMetadata() {
  if (!cachedSkills) {
    return initializeSkillCache();
  }

  return cachedSkills;
}

module.exports = {
  getSkillMetadata,
  initializeSkillCache,
};
