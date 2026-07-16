// Generated for: https://github.com/orslon/Testing
// Pipeline: Build → Unit Test → SAST (ESLint + SonarQube) → Docker Build
//           → DAST (OWASP ZAP) → Deploy (optional) → Notify
//
// Jenkins plugins required:
//   - Pipeline
//   - Docker Pipeline
//   - HashiCorp Vault Plugin  (if using Vault for secrets)
//   - SonarQube Scanner
//   - HTML Publisher          (for ZAP report)
//
// Jenkins credentials required (Manage Jenkins → Credentials):
//   - DOCKER_PASSWORD  : Secret text  → your Docker Hub password
//   - SONAR_TOKEN      : Secret text  → your SonarQube/SonarCloud token
//   - SLACK_WEBHOOK    : Secret text  → your Slack incoming webhook URL
//
// Environment variables to set in Jenkins (Manage Jenkins → Configure System):
//   - SONAR_HOST_URL   : https://sonarcloud.io  (or your self-hosted Sonar)
//   - DOCKER_REGISTRY  : docker.io
//   - DOCKER_IMAGE     : yourname/testing-app   (update this)

pipeline {
  agent any

  environment {
    APP_PORT        = '3000'
    DOCKER_IMAGE    = 'yourname/testing-app'   // ← update with your Docker Hub username
    DOCKER_REGISTRY = 'docker.io'
    SONAR_HOST_URL  = 'https://sonarcloud.io'  // ← update if self-hosted
    ZAP_REPORT_DIR  = 'zap-reports'
  }

  stages {

    // ─────────────────────────────────────────────────
    // STAGE 1: Checkout
    // ─────────────────────────────────────────────────
    stage('Checkout') {
      steps {
        checkout scm
        echo "Checked out branch: ${env.BRANCH_NAME ?: 'main'}"
      }
    }

    // ─────────────────────────────────────────────────
    // STAGE 2: Install dependencies
    // ─────────────────────────────────────────────────
    stage('Install') {
      steps {
        sh 'node --version'
        sh 'npm --version'
        sh 'npm ci'
      }
    }

    // ─────────────────────────────────────────────────
    // STAGE 3: Unit Tests + Coverage
    // ─────────────────────────────────────────────────
    stage('Unit Tests') {
      steps {
        sh 'npm test -- --coverage'
      }
      post {
        always {
          // Publish HTML coverage report
          publishHTML(target: [
            allowMissing         : false,
            alwaysLinkToLastBuild: true,
            keepAll              : true,
            reportDir            : 'coverage/lcov-report',
            reportFiles          : 'index.html',
            reportName           : 'Coverage Report'
          ])
        }
      }
    }

    // ─────────────────────────────────────────────────
    // STAGE 4: SAST — ESLint Security Rules
    //   Catches: eval, unsafe regex, object injection,
    //            timing attacks, non-literal fs calls
    // ─────────────────────────────────────────────────
    stage('SAST - ESLint') {
      steps {
        sh 'npm run lint'
        echo 'ESLint SAST scan passed'
      }
    }

    // ─────────────────────────────────────────────────
    // STAGE 5: SAST — SonarQube / SonarCloud
    //   Runs full static analysis: code smells, bugs,
    //   security hotspots, duplications, coverage gate
    // ─────────────────────────────────────────────────
    stage('SAST - SonarQube') {
      steps {
        withCredentials([string(credentialsId: 'SONAR_TOKEN', variable: 'SONAR_TOKEN')]) {
          sh '''
            docker run --rm \
              -e SONAR_TOKEN=$SONAR_TOKEN \
              -e SONAR_HOST_URL=${SONAR_HOST_URL} \
              -v $(pwd):/usr/src \
              sonarsource/sonar-scanner-cli:latest \
              -Dsonar.projectKey=orslon_Testing \
              -Dsonar.organization=orslon \
              -Dsonar.sources=src \
              -Dsonar.tests=test \
              -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
          '''
        }
      }
    }

    // ─────────────────────────────────────────────────
    // STAGE 6: Docker Build
    //   Builds the container image tagged with BUILD_NUMBER
    // ─────────────────────────────────────────────────
    stage('Docker Build') {
      steps {
        sh 'docker build -t ${DOCKER_IMAGE}:${BUILD_NUMBER} -t ${DOCKER_IMAGE}:latest .'
        echo "Built image: ${DOCKER_IMAGE}:${BUILD_NUMBER}"
      }
    }

    // ─────────────────────────────────────────────────
    // STAGE 7: Container Security Scan — Trivy
    //   Scans the built Docker image for OS + library CVEs
    //   Fails on CRITICAL severity
    // ─────────────────────────────────────────────────
    stage('Container Scan - Trivy') {
      steps {
        sh '''
          docker run --rm \
            -v /var/run/docker.sock:/var/run/docker.sock \
            aquasec/trivy:latest image \
            --severity CRITICAL,HIGH \
            --exit-code 1 \
            --ignore-unfixed \
            ${DOCKER_IMAGE}:${BUILD_NUMBER}
        '''
      }
    }

    // ─────────────────────────────────────────────────
    // STAGE 8: DAST — OWASP ZAP
    //   Starts the app in Docker, runs ZAP full scan
    //   against the live running instance, then stops it.
    //   Report published as HTML artifact.
    // ─────────────────────────────────────────────────
    stage('DAST - OWASP ZAP') {
      steps {
        script {
          // Start the app container
          sh """
            docker run -d \
              --name testing-app-dast \
              -p ${APP_PORT}:3000 \
              ${DOCKER_IMAGE}:${BUILD_NUMBER}
          """

          // Give it a few seconds to be ready
          sh 'sleep 5'

          // Verify the app is up
          sh "curl -sf http://localhost:${APP_PORT}/health || (docker stop testing-app-dast && docker rm testing-app-dast && exit 1)"

          // Create report dir
          sh "mkdir -p ${ZAP_REPORT_DIR}"

          // Run OWASP ZAP full scan
          // --network host so ZAP container can reach the app on localhost
          sh """
            docker run --rm \
              --network host \
              -v \$(pwd)/${ZAP_REPORT_DIR}:/zap/wrk/:rw \
              -v \$(pwd)/zap.conf:/zap/wrk/zap.conf:ro \
              ghcr.io/zaproxy/zaproxy:stable zap-full-scan.py \
              -t http://localhost:${APP_PORT} \
              -r zap-report.html \
              -J zap-report.json \
              -z "-config_file /zap/wrk/zap.conf" \
              -I
          '''
          // Note: -I = don't fail on warnings (only fail on alerts with risk >= HIGH)
          // Remove -I if you want to fail on any alert
        }
      }
      post {
        always {
          // Stop and clean up the app container whether ZAP passed or failed
          sh 'docker stop testing-app-dast || true'
          sh 'docker rm testing-app-dast || true'

          // Publish ZAP HTML report
          publishHTML(target: [
            allowMissing         : true,
            alwaysLinkToLastBuild: true,
            keepAll              : true,
            reportDir            : "${ZAP_REPORT_DIR}",
            reportFiles          : 'zap-report.html',
            reportName           : 'OWASP ZAP DAST Report'
          ])

          // Archive JSON report for downstream processing
          archiveArtifacts artifacts: "${ZAP_REPORT_DIR}/zap-report.json", allowEmptyArchive: true
        }
      }
    }

    // ─────────────────────────────────────────────────
    // STAGE 9: Docker Push
    //   Pushes the scanned, verified image to Docker Hub
    // ─────────────────────────────────────────────────
    stage('Docker Push') {
      steps {
        withCredentials([string(credentialsId: 'DOCKER_PASSWORD', variable: 'DOCKER_PASSWORD')]) {
          sh 'docker login -u yourname -p "$DOCKER_PASSWORD" ${DOCKER_REGISTRY}'
          sh 'docker push ${DOCKER_IMAGE}:${BUILD_NUMBER}'
          sh 'docker push ${DOCKER_IMAGE}:latest'
        }
      }
    }

    // ─────────────────────────────────────────────────
    // STAGE 10: Deploy (optional — update script as needed)
    //   Simple example: SSH to a server and pull the new image.
    //   Replace with your actual deploy mechanism.
    // ─────────────────────────────────────────────────
    stage('Deploy') {
      when {
        branch 'main'   // only deploy from main branch
      }
      steps {
        echo "Deploying ${DOCKER_IMAGE}:${BUILD_NUMBER} to target..."
        // Example: pull the new image on a remote server via SSH
        // sh 'ssh deploy@your-server "docker pull ${DOCKER_IMAGE}:${BUILD_NUMBER} && docker compose up -d"'
        sh 'echo "TODO: configure your deploy step"'
      }
    }

  } // end stages

  post {
    // ─────────────────────────────────────────────────
    // NOTIFY: Slack (always runs — reports pass or fail)
    // ─────────────────────────────────────────────────
    always {
      withCredentials([string(credentialsId: 'SLACK_WEBHOOK', variable: 'SLACK_WEBHOOK')]) {
        sh '''
          STATUS="${currentBuild.currentResult}"
          COLOR="good"
          if [ "$STATUS" = "FAILURE" ]; then COLOR="danger"; fi
          if [ "$STATUS" = "UNSTABLE" ]; then COLOR="warning"; fi

          curl -sS -X POST \
            -H 'Content-type: application/json' \
            --data "{
              \"attachments\": [{
                \"color\": \"$COLOR\",
                \"title\": \"Jenkins Build: ${JOB_NAME} #${BUILD_NUMBER}\",
                \"text\": \"Status: *$STATUS*\nBranch: ${BRANCH_NAME:-main}\nImage: ${DOCKER_IMAGE}:${BUILD_NUMBER}\",
                \"footer\": \"${BUILD_URL}\"
              }]
            }" \
            "$SLACK_WEBHOOK"
        '''
      }

      // Clean up local Docker images to save disk space
      sh 'docker rmi ${DOCKER_IMAGE}:${BUILD_NUMBER} || true'
      sh 'docker rmi ${DOCKER_IMAGE}:latest || true'
    }
  }

}
