import { defineConfig } from 'vitepress';

const canonicalBase = 'https://docs.4626.fun';

export default defineConfig({
  title: 'CreatorVault Docs',
  description: 'CreatorVault documentation portal.',
  base: '/',
  outDir: 'dist',
  srcDir: './content',
  head: [
    ['link', { rel: 'canonical', href: `${canonicalBase}/` }]
  ],
  transformHead: ({ pageData }) => {
    const canonicalPath = pageData.relativePath
      ? pageData.relativePath.replace(/README\.md$/i, '').replace(/\.md$/i, '')
      : '';
    const canonicalUrl = canonicalPath ? `${canonicalBase}/${canonicalPath}` : `${canonicalBase}/`;
    return [
      ['link', { rel: 'canonical', href: canonicalUrl }]
    ];
  },
  themeConfig: {
    nav: [
      { text: 'Deployment', link: '/deployment/PRODUCTION_DEPLOYMENT' },
      { text: 'AA', link: '/aa/AA_READY_NOW' },
      { text: 'Strategies', link: '/strategies/ajna/CREATOR_AJNA_GUIDE' },
      { text: 'Architecture', link: '/architecture/FULL_PLATFORM_ARCHITECTURE' },
      { text: 'Operations', link: '/ops/DOMAIN_SETUP' }
    ],
    sidebar: {
      '/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Overview', link: '/' },
            { text: 'Frontend Integration', link: '/FRONTEND_INTEGRATION_GUIDE' },
            { text: 'Strategy Deploy Checklist', link: '/STRATEGY_DEPLOY_CHECKLIST' }
          ]
        },
        {
          text: 'Deployment',
          collapsed: true,
          items: [
            { text: 'Production Deployment', link: '/deployment/PRODUCTION_DEPLOYMENT' },
            { text: 'Creator Launch Guide', link: '/deployment/CREATOR_LAUNCH_GUIDE' },
            { text: 'Deployment Approvals Guide', link: '/deployment/DEPLOYMENT_APPROVALS_GUIDE' },
            { text: 'Required Approvals Checklist', link: '/deployment/REQUIRED_APPROVALS_CHECKLIST' },
            { text: 'Pre-Launch Verification', link: '/deployment/PRE_LAUNCH_VERIFICATION' },
            { text: 'CCA Deployment Verification', link: '/deployment/CCA_DEPLOYMENT_VERIFICATION' },
            { text: 'Create2 Registry', link: '/deployment/CREATE2_REGISTRY' },
            {
              text: 'Launch',
              items: [
                { text: 'Launch Checklist', link: '/deployment/launch/LAUNCH_CHECKLIST' },
                { text: 'Launch Ready', link: '/deployment/launch/LAUNCH_READY' },
                { text: 'Launch Verification', link: '/deployment/launch/LAUNCH_VERIFICATION' }
              ]
            },
            {
              text: 'Multisig',
              items: [
                { text: 'Deployment With Multisig', link: '/deployment/multisig/DEPLOYMENT_WITH_MULTISIG' },
                { text: 'Final Multisig Deployment Guide', link: '/deployment/multisig/FINAL_MULTISIG_DEPLOYMENT_GUIDE' },
                { text: 'Multisig Owner Setup', link: '/deployment/multisig/MULTISIG_OWNER_SETUP' }
              ]
            }
          ]
        },
        {
          text: 'AA',
          collapsed: true,
          items: [
            { text: 'AA Ready Now', link: '/aa/AA_READY_NOW' },
            { text: 'AA Activation', link: '/aa/AA_ACTIVATION' },
            { text: 'AA Deployment Flow', link: '/aa/AA_DEPLOYMENT_FLOW' },
            { text: 'AA Strategy Deployment', link: '/aa/AA_STRATEGY_DEPLOYMENT' },
            { text: 'Full AA Solution', link: '/aa/FULL_AA_SOLUTION' },
            { text: 'Operator Auth', link: '/aa/OPERATOR_AUTH' },
            { text: 'Notes', link: '/aa/notes' }
          ]
        },
        {
          text: 'Strategies',
          collapsed: true,
          items: [
            {
              text: 'Ajna',
              items: [
                { text: 'Creator Ajna Guide', link: '/strategies/ajna/CREATOR_AJNA_GUIDE' },
                { text: 'Ajna Deployment', link: '/strategies/ajna/AJNA_DEPLOYMENT' },
                { text: 'Ajna Bucket Calculator', link: '/strategies/ajna/AJNA_BUCKET_CALCULATOR' },
                { text: 'Ajna ERC4626 Vault Review', link: '/strategies/ajna/AJNA_ERC4626_VAULT_REVIEW' }
              ]
            },
            {
              text: 'Uniswap V3',
              items: [
                { text: 'Creator Charm Guide', link: '/strategies/univ3/CREATOR_CHARM_GUIDE' },
                { text: 'Creator USDC Deployment', link: '/strategies/univ3/CREATOR_USDC_DEPLOYMENT' },
                { text: 'Creator WETH Analysis', link: '/strategies/univ3/CREATOR_WETH_ANALYSIS' }
              ]
            }
          ]
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Full Platform Architecture', link: '/architecture/FULL_PLATFORM_ARCHITECTURE' },
            { text: 'Strategy Architecture', link: '/architecture/STRATEGY_ARCHITECTURE' },
            { text: 'Fee Architecture', link: '/architecture/FEE_ARCHITECTURE' },
            { text: 'Governance Acceptance Explained', link: '/architecture/GOVERNANCE_ACCEPTANCE_EXPLAINED' },
            { text: 'Contract Size Issue', link: '/architecture/CONTRACT_SIZE_ISSUE' },
            { text: 'Final Solution', link: '/architecture/FINAL_SOLUTION' }
          ]
        },
        {
          text: 'Automation',
          collapsed: true,
          items: [
            { text: 'Creator Automation Guide', link: '/automation/CREATOR_AUTOMATION_GUIDE' },
            { text: 'Automated Deployment Quick Start', link: '/automation/AUTOMATED_DEPLOYMENT_QUICK_START' },
            { text: 'Automated Completion Options', link: '/automation/AUTOMATED_COMPLETION_OPTIONS' },
            { text: 'Full Automation Implemented', link: '/automation/FULL_AUTOMATION_IMPLEMENTED' }
          ]
        },
        {
          text: 'Integrations',
          collapsed: true,
          items: [
            { text: 'Solana Integration', link: '/integrations/solana-integration' },
            { text: 'Frontend Integration Guide', link: '/FRONTEND_INTEGRATION_GUIDE' }
          ]
        },
        {
          text: 'Governance',
          collapsed: true,
          items: [
            { text: 'VE33 Progress', link: '/governance/VE33_PROGRESS' }
          ]
        },
        {
          text: 'Lottery',
          collapsed: true,
          items: [
            { text: 'Lottery Integration Fix', link: '/lottery/LOTTERY_INTEGRATION_FIX' },
            { text: 'Lottery Omnidgragon Pattern', link: '/lottery/LOTTERY_OMNIDRAGON_PATTERN' },
            { text: 'Multi Strategy Allocation', link: '/lottery/MULTI_STRATEGY_ALLOCATION' },
            { text: 'Multi Token Jackpot', link: '/lottery/MULTI_TOKEN_JACKPOT' }
          ]
        },
        {
          text: 'Naming',
          collapsed: true,
          items: [
            { text: 'Custom Vault Naming', link: '/naming/CUSTOM_VAULT_NAMING' },
            { text: 'Standard Naming Pattern', link: '/naming/STANDARD_NAMING_PATTERN' }
          ]
        },
        {
          text: 'Operations',
          collapsed: true,
          items: [
            { text: 'Domain Setup', link: '/ops/DOMAIN_SETUP' },
            { text: 'Supabase Setup', link: '/ops/SUPABASE_SETUP' }
          ]
        },
        {
          text: 'Troubleshooting',
          collapsed: true,
          items: [
            { text: 'Compilation Status', link: '/troubleshooting/COMPILATION_STATUS' },
            { text: 'Delayed Completion Analysis', link: '/troubleshooting/DELAYED_COMPLETION_ANALYSIS' }
          ]
        },
        {
          text: 'Other Docs',
          collapsed: true,
          items: [
            { text: 'Create2 Overview', link: '/create2' },
            { text: 'Examples: Akita Launch Now', link: '/examples/AKITA_LAUNCH_NOW' },
            { text: 'Notes', link: '/notes' }
          ]
        }
      ]
    }
  }
});
