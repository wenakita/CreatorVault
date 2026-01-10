import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import HomepageFeatures from '@site/src/components/HomepageFeatures';
import styles from './index.module.css';

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Creator Vaults protocol documentation and brand system">
      <div className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.heroContent}>
            <span className={styles.kicker}>Protocol Documentation</span>
            <Heading as="h1" className={styles.title}>
              Creator Vaults
            </Heading>
            <p className={styles.subtitle}>
              System-level guidance for deployment, architecture, strategies,
              and the Glass &amp; Steel identity.
            </p>
            <div className={styles.actions}>
              <Link className={styles.primaryButton} to="/docs">
                Open Docs
              </Link>
              <Link className={styles.ghostButton} to="/docs/brand-kit/overview">
                Brand Kit
              </Link>
            </div>
          </div>

          <div className={styles.heroPanel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelDot} />
              System Status
            </div>
            <div className={styles.panelBody}>
              <div className={styles.panelRow}>
                <span>DOCS_STATE</span>
                <span className={styles.panelValue}>READY</span>
              </div>
              <div className={styles.panelRow}>
                <span>CORE_MODULES</span>
                <span className={styles.panelValue}>ONLINE</span>
              </div>
              <div className={styles.panelRow}>
                <span>BRAND_KERNEL</span>
                <span className={styles.panelValue}>SYNCED</span>
              </div>
              <div className={styles.panelFoot}>
                <span>REFRESH_INTERVAL</span>
                <span className={styles.panelValue}>02:40</span>
              </div>
            </div>
          </div>
        </header>

        <HomepageFeatures />
      </div>
    </Layout>
  );
}
