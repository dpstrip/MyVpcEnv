import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';


//Create a VPC that I will keep around and create a ec2 server that I can attach to.
//Go to EKS console and create a key by selecting key pair on left side and then creating a new
//key.  call it ec2-key-pair.  Choose pem.  Store it.  If you want to SSH into the EC2 server go ahead and 
//get the key.

export class MyVpcEnvStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'my-vpc-env',{
    cidr: '10.0.0.0/16',
    natGateways: 0,
    maxAzs: 2,
    subnetConfiguration:[
      {
        name: 'isolated-subnet-1',
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        cidrMask: 28
      },
      ],
      gatewayEndpoints:{
        s3: {service: ec2.GatewayVpcEndpointAwsService.S3
      }}
  });
  //Creae security group for ec2
  const ec2InstanceSG = new ec2.SecurityGroup(this, 'ec2-instance-sg2', {
    vpc,
  });
  ec2InstanceSG.addIngressRule(
    ec2.Peer.ipv4('3.83.200.219/32'),
    ec2.Port.tcp(22),
    'allow ssh connections from Sparx',);
    
   ec2InstanceSG.addIngressRule(
    ec2.Peer.ipv4('3.83.200.219/32'),
    ec2.Port.tcp(80),
    'allow http connections from Sparx',);
    
   ec2InstanceSG.addIngressRule(
    ec2.Peer.ipv4('3.83.200.219/32'),
    ec2.Port.tcp(443),
    'allow https connections from Sparx',);
    
    //This line put in a Security group rule to allow all traffic from the vpc cidr block to communicate via port 443
    ec2InstanceSG.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(443));
    //trying to get access into server
     [
     ec2.InterfaceVpcEndpointAwsService.EC2,
     ec2.InterfaceVpcEndpointAwsService.SSM,
     ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
     ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES
     ].forEach(e=> vpc.addInterfaceEndpoint(e.shortName,{service: e, securityGroups:[ec2InstanceSG]}));
     
     const vpcInteraceEndpoint = new ec2.InterfaceVpcEndpoint(this, 'ec2Vpc', {
         vpc: vpc,
         securityGroups: [ec2InstanceSG],
        // privateDnsEnabled: true,
         service: new ec2.InterfaceVpcEndpointService(`com.amazonaws.${this.region}.ec2`, 443)
     })
    
    //Create ec2 instance
    const ec2Instance = new ec2.Instance(this, 'ec2-instance', {
      vpc,
      vpcSubnets:{
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroup: ec2InstanceSG,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2,
      ec2.InstanceSize.MICRO,),
      
      machineImage: new ec2.AmazonLinuxImage({ generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,}),
      keyName: 'ec2-key-pair',
    });
    //Put a policy in the ec2 to connect to it
    ec2Instance.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));
    ec2Instance.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));
  }
}
