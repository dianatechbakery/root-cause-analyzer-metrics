import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';

export class RootCauseAnalyzerMetricsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // CloudWatch Log Groups
    const producerLogGroup = new logs.LogGroup(this, 'ProducerLogGroup', {
      logGroupName: '/aws/lambda/producer-lambda',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const analyzerLogGroup = new logs.LogGroup(this, 'AnalyzerLogGroup', {
      logGroupName: '/aws/lambda/analyzer-lambda',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // SQS Queue
    const queue = new sqs.Queue(this, 'MetricsQueue', {
      visibilityTimeout: cdk.Duration.seconds(300),
    });

    // Producer Lambda
    const producerFunction = new lambda.Function(this, 'ProducerFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('src'),
      handler: 'producer.handler',
      logGroup: producerLogGroup,
      environment: {
        QUEUE_URL: queue.queueUrl,
      },
    });

    producerFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cloudwatch:PutMetricData', 'logs:CreateLogStream', 'logs:PutLogEvents', 'sqs:SendMessage'],
      resources: ['*'],
    }));

    // Analyzer Lambda
    const analyzerFunction = new lambda.Function(this, 'AnalyzerFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('src'),
      handler: 'analyzer.handler',
      logGroup: analyzerLogGroup,
      environment: {
        QUEUE_URL: queue.queueUrl,
      },
    });

    analyzerFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cloudwatch:GetMetricData', 'cloudwatch:ListMetrics', 'logs:DescribeLogGroups', 'logs:DescribeLogStreams', 'logs:GetLogEvents', 'sqs:ReceiveMessage', 'sqs:DeleteMessage'],
      resources: ['*'],
    }));

    // Add SQS event source to Analyzer
    analyzerFunction.addEventSourceMapping('SQSEventSource', {
      eventSourceArn: queue.queueArn,
      batchSize: 10,
    });

    // API Gateway with throttling
    const api = new apigateway.RestApi(this, 'MetricsApi', {
      restApiName: 'metrics-api',
      description: 'API for metrics collection',
    });

    const integration = new apigateway.LambdaIntegration(producerFunction);
    const resource = api.root.addResource('collect');
    resource.addMethod('POST', integration, {
      methodResponses: [{ statusCode: '200' }],
    });

    // Throttling at API level
    const deployment = new apigateway.Deployment(this, 'Deployment', { api });
    const stage = new apigateway.Stage(this, 'Stage', {
      deployment,
      stageName: 'prod',
      throttlingRateLimit: 10, // requests per second
      throttlingBurstLimit: 20,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: stage.urlForPath('/collect'),
    });
  }
}
