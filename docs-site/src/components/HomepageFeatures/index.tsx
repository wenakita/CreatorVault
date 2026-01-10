import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';

import styles from './styles.module.css';

type FeatureItem = {
  label: string;
  title: string;
  description: string;
  to: string;
};

const FeatureList: FeatureItem[] = [
  {
    label: 'Deployment',
    title: 'Launch and verify vault infrastructure.',
    description:
      'Checklists, approvals, and deployment flows to move safely from staging to production.',
    to: '/docs/deployment/PRODUCTION_DEPLOYMENT',
  },
  {
    label: 'Architecture',
    title: 'Understand the protocol stack.',
    description:
      'Deep dives on strategy architecture, fee mechanics, and governance acceptance.',
    to: '/docs/architecture/FULL_PLATFORM_ARCHITECTURE',
  },
  {
    label: 'Brand System',
    title: 'Glass & Steel identity kit.',
    description:
      'Color, typography, motion, and UI primitives for the ERCreator4626 experience.',
    to: '/docs/brand-kit/brand-guidelines',
  },
];

function FeatureCard({label, title, description, to}: FeatureItem) {
  return (
    <Link className={styles.card} to={to}>
      <span className={styles.cardLabel}>{label}</span>
      <Heading as="h3" className={styles.cardTitle}>
        {title}
      </Heading>
      <p className={styles.cardDescription}>{description}</p>
      <span className={styles.cardAction}>Open dossier</span>
    </Link>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className={styles.featuresInner}>
        {FeatureList.map((feature) => (
          <FeatureCard key={feature.title} {...feature} />
        ))}
      </div>
    </section>
  );
}
