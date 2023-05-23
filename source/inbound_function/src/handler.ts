import { Context } from "aws-lambda";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { LambdaFunctionEvent } from "./application/lambdaFunctionEvent";
import { TelegramMessage } from "./application/telegramMessage";
import { v4 as uuidv4 } from "uuid";
import * as resource from './resources/resource.json';

export const handler = async (event: LambdaFunctionEvent, context: Context) => {
  const failedMessageIds: string[] = [];

  event.Records.forEach(record => {
    try {
      const bodyMessage = Buffer.from(record.body, "base64").toString(
        "binary"
      );
      handleRecord(bodyMessage, context);
    } catch (error) {
      failedMessageIds.push(record.messageId);
    }
  });

  return {
    // https://www.serverless.com/blog/improved-sqs-batch-error-handling-with-aws-lambda
    // https://docs.aws.amazon.com/prescriptive-guidance/latest/lambda-event-filtering-partial-batch-responses-for-sqs/best-practices-partial-batch-responses.html
    // https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#services-sqs-batchfailurereporting
    batchItemFailures: failedMessageIds.map(id => {
      return {
        itemIdentifier: id
      }
    })
  }
};

const handleRecord = async (bodyMessage: string, context: Context) => {
  const sqsClient = new SQSClient({ region: process.env.AWSRegion });
  const telegramMessage: TelegramMessage = JSON.parse(bodyMessage);
  const outgoingMessage = handleMessage(telegramMessage);
  const awsAccountID = context.invokedFunctionArn.split(":")[4];
  const params = {
    MessageGroupId: `${telegramMessage.message.chat.id}`,
    MessageDeduplicationId: uuidv4(),
    MessageBody: JSON.stringify({
      chatid: telegramMessage.message.chat.id,
      message: outgoingMessage,
    }),
    QueueUrl: `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${awsAccountID}/${process.env.OutboundQueueName}`,
  };
  const data = await sqsClient.send(new SendMessageCommand(params));
};

function handleMessage(telegramMessage: TelegramMessage) {
  switch (telegramMessage.message.text) {
    case "/start":
      return welcomeMessage(telegramMessage);
    case "/map":
      return mapMessage(telegramMessage);
    case "/info":
      return infoMessage(telegramMessage);
  }
};

function welcomeMessage(telegramMessage: TelegramMessage) {
  return resource.welcome_message.join('\n');
};

function mapMessage(telegramMessage: TelegramMessage) {
  return resource.map_message.join('\n');
};

function infoMessage(telegramMessage: TelegramMessage) {
  return resource.info_message.join('\n');
};