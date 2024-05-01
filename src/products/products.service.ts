import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaClient } from '@prisma/client';
import { PaginationDto } from '../common/dtos/pagination.dto';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class ProductsService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(ProductsService.name);

  onModuleInit() {
    this.$connect();
    this.logger.log('Database connected');
  }

  async create(createProductDto: CreateProductDto) {
    const createdProduct = await this.product.create({
      data: createProductDto,
    });
    return createdProduct;
  }

  async findAll(paginationDto: PaginationDto) {
    const { limit, page } = paginationDto;

    const totalProducts = await this.product.count({
      where: { available: true },
    });
    const lastPage = Math.round(totalProducts / limit);

    return {
      data: await this.product.findMany({
        skip: (page - 1) * limit,
        take: limit,
        where: { available: true },
      }),
      meta: {
        page,
        totalProducts,
        lastPage,
      },
    };
  }

  async findOne(id: number) {
    const product = await this.product.findUnique({
      where: { id, available: true },
    });

    if (!product)
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: `Product with id #${id} not found`,
      });

    return product;
  }

  async update(id: number, updateProductDto: UpdateProductDto) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _, ...data } = updateProductDto;
    await this.findOne(id);
    return await this.product.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return await this.product.update({
      where: { id },
      data: { available: false },
    });
  }

  async validateProducts(productIds: number[]) {
    const uniquesIds = [...new Set(productIds)];

    const products = await this.product.findMany({
      where: {
        id: {
          in: uniquesIds,
        },
      },
    });

    if (products.length != uniquesIds.length) {
      const productsIds = products.map((product) => product.id);
      const unknownProductsIds = uniquesIds
        .filter((id) => !productsIds.includes(id))
        .join();

      throw new RpcException({
        message: `Products [${unknownProductsIds}] were not found`,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    return products;
  }
}
