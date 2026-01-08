pipeline {
    agent any
    environment {
        AWS_ACCOUNT_ID = credentials('aws-account-id')
        AWS_DEFAULT_REGION = 'us-east-1'
        ECR_REPO_FRONTEND = 'awad-frontend'
        ECR_REPO_BACKEND = 'awad-backend'
        EC2_HOST = 'ubuntu@3.84.120.134'
        AWS_SECRET_ID = 'awad/prod/env'
    // IMAGE_TAG will be set dynamically
    }
    stages {
        stage('Setup') {
            steps {
                sh '''
          export NVM_DIR="$HOME/.nvm"
          [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

          node -v
          npm -v
        '''
            }
        }
        stage('Detect Changes') {
            steps {
                script {
                    // If this is the first build, assume everything changed
                    if (env.GIT_PREVIOUS_COMMIT == null) {
                        env.FRONTEND_CHANGED = 'true'
                        env.BACKEND_CHANGED = 'true'
                    } else {
                        def changedFiles = sh(script: "git diff --name-only ${env.GIT_PREVIOUS_COMMIT} ${env.GIT_COMMIT}", returnStdout: true).trim()
                        env.FRONTEND_CHANGED = changedFiles.contains('frontend/') ? 'true' : 'false'
                        env.BACKEND_CHANGED = changedFiles.contains('backend/') ? 'true' : 'false'
                    }
                    env.IMAGE_TAG = "${env.BUILD_NUMBER}-${env.GIT_COMMIT.take(7)}"
                    echo "Frontend changed: ${env.FRONTEND_CHANGED}"
                    echo "Backend changed: ${env.BACKEND_CHANGED}"
                    echo "Image Tag: ${env.IMAGE_TAG}"
                }
            }
        }

        stage('Build & Test Backend') {
            when { expression { return env.BACKEND_CHANGED == 'true' } }
            steps {
                dir('backend') {
                    sh 'npm ci'
                    sh 'npm run build'
                // sh 'npm test'
                }
            }
        }

        stage('Build & Test Frontend') {
            when { expression { return env.FRONTEND_CHANGED == 'true' } }
            steps {
                dir('frontend') {
                    sh 'npm ci'
                    sh 'npm run build'
                // sh 'npm run lint'
                }
            }
        }

        stage('Build Docker Images') {
            steps {
                script {
                    if (env.BACKEND_CHANGED == 'true') {
                        sh "docker build -t ${ECR_REPO_BACKEND}:${IMAGE_TAG} ./backend"
                    }
                    if (env.FRONTEND_CHANGED == 'true') {
                        sh "docker build -t ${ECR_REPO_FRONTEND}:${IMAGE_TAG} ./frontend"
                    }
                }
            }
        }

        stage('Push to ECR') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'aws-credentials', passwordVariable: 'AWS_SECRET_ACCESS_KEY', usernameVariable: 'AWS_ACCESS_KEY_ID')]) {
                    script {
                        sh "aws ecr get-login-password --region ${AWS_DEFAULT_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com"

                        if (env.BACKEND_CHANGED == 'true') {
                            def repoUrl = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com/${ECR_REPO_BACKEND}"
                            sh "docker tag ${ECR_REPO_BACKEND}:${IMAGE_TAG} ${repoUrl}:${IMAGE_TAG}"
                            sh "docker push ${repoUrl}:${IMAGE_TAG}"
                            sh "docker rmi ${repoUrl}:${IMAGE_TAG}"
                            sh "docker rmi ${ECR_REPO_BACKEND}:${IMAGE_TAG}"
                        }
                        if (env.FRONTEND_CHANGED == 'true') {
                            def repoUrl = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com/${ECR_REPO_FRONTEND}"
                            sh "docker tag ${ECR_REPO_FRONTEND}:${IMAGE_TAG} ${repoUrl}:${IMAGE_TAG}"
                            sh "docker push ${repoUrl}:${IMAGE_TAG}"
                            sh "docker rmi ${repoUrl}:${IMAGE_TAG}"
                            sh "docker rmi ${ECR_REPO_FRONTEND}:${IMAGE_TAG}"
                        }
                    }
                }
            }
        }

        stage('Provision Secrets') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'aws-credentials', passwordVariable: 'AWS_SECRET_ACCESS_KEY', usernameVariable: 'AWS_ACCESS_KEY_ID')]) {
                    script {
                        def nodeScript = """
const fs = require('fs');
const { execSync } = require('child_process');

const secretId = process.env.AWS_SECRET_ID;
const region = process.env.AWS_DEFAULT_REGION;

function parseEnv(filePath) {
    const keys = {};
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        content.split('\\n').forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#')) {
                const [key] = line.split('=');
                if (key) keys[key.trim()] = "CHANGE_ME";
            }
        });
    }
    return keys;
}

console.log("Collecting .env.example files...");
const newSecrets = {
    ...parseEnv('backend/.env.example'),
    ...parseEnv('frontend/.env.example')
};

if (Object.keys(newSecrets).length === 0) {
    console.log("No keys found.");
    process.exit(0);
}

let existingSecrets = {};
let secretExists = false;

try {
    const cmd = `aws secretsmanager get-secret-value --secret-id \${secretId} --region \${region} --query SecretString --output text`;
    const output = execSync(cmd, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    existingSecrets = JSON.parse(output);
    secretExists = true;
    console.log("Found existing secret.");
} catch (e) {
    console.log("Secret not found, will create new.");
}

const finalSecrets = { ...newSecrets, ...existingSecrets };

if (JSON.stringify(finalSecrets) === JSON.stringify(existingSecrets)) {
    console.log("No changes needed.");
    process.exit(0);
}

const secretString = JSON.stringify(finalSecrets);
fs.writeFileSync('secrets.json', secretString);

try {
    if (secretExists) {
        console.log("Updating secret...");
        execSync(`aws secretsmanager put-secret-value --secret-id \${secretId} --region \${region} --secret-string file://secrets.json`);
    } else {
        console.log("Creating secret...");
        execSync(`aws secretsmanager create-secret --name \${secretId} --region \${region} --secret-string file://secrets.json`);
    }
    console.log("Secrets provisioned.");
} catch (e) {
    console.error("Failed to update secrets:", e.message);
    process.exit(1);
}
"""
                        writeFile file: 'provision_secrets.js', text: nodeScript
                        sh 'node provision_secrets.js'
                        sh 'rm provision_secrets.js secrets.json || true'
                    }
                }
            }
        }

        stage('Deploy to EC2') {
            steps {
                sshagent(['ec2-ssh-key']) {
                    // Copy docker-compose.prod.yml to EC2 as docker-compose.yml
                    sh "scp -o StrictHostKeyChecking=no docker-compose.prod.yml ${EC2_HOST}:~/docker-compose.yml"

                    // Deploy using the helper script installed by Terraform user_data
                    sh """
                        ssh -o StrictHostKeyChecking=no ${EC2_HOST} '
                            export IMAGE_TAG=${IMAGE_TAG}
                            export AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID}
                            export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION}

                            # Login to ECR (still needed for pull)
                            aws ecr get-login-password --region ${AWS_DEFAULT_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com

                            # Use the helper script to deploy
                            # This fetches the secret, writes .env, and restarts compose
                            /usr/local/bin/deploy-app.sh ${AWS_SECRET_ID}
                        '
                    """
                }
            }
        }
    }

    post {
        always {
            script {
                echo 'Cleaning up workspace...'
                // Clean up workspace
                cleanWs()
            }
        }
    }
}
