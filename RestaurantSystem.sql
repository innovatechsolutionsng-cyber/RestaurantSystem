-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: restaurant_system
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(128) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` VALUES (1,'Drinks',NULL,'2026-07-03 17:06:36'),(2,'Rice',NULL,'2026-07-03 17:15:23'),(3,'Swallow',NULL,'2026-07-03 17:18:06'),(4,'Meat',NULL,'2026-07-03 17:20:55'),(5,'Turkey',NULL,'2026-07-03 17:21:02'),(6,'Vegetable',NULL,'2026-07-03 18:25:47');
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_items`
--

DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `product_id` int DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_items`
--

LOCK TABLES `order_items` WRITE;
/*!40000 ALTER TABLE `order_items` DISABLE KEYS */;
INSERT INTO `order_items` VALUES (1,1,9,'Fried Rice',3,500.00,'2026-07-08 17:18:26'),(2,1,4,'Eva Table Water',1,400.00,'2026-07-08 17:18:27'),(3,1,6,'Jollof Rice',3,500.00,'2026-07-08 17:18:27'),(4,2,9,'Fried Rice',1,500.00,'2026-07-08 17:41:54'),(5,2,2,'Fanta',1,700.00,'2026-07-08 17:41:54'),(6,2,4,'Eva Table Water',1,400.00,'2026-07-08 17:41:54'),(7,2,7,'5 Alive Active',1,2500.00,'2026-07-08 17:41:54'),(8,3,16,'Beef',2,500.00,'2026-07-09 02:33:40'),(9,3,15,'Bush Meat',1,5000.00,'2026-07-09 02:33:40'),(10,3,19,'Amala',3,300.00,'2026-07-09 02:33:40'),(11,3,17,'Ponmo',2,500.00,'2026-07-09 02:33:42'),(12,3,4,'Eva Table Water',1,400.00,'2026-07-09 02:33:42'),(13,4,19,'Amala',3,300.00,'2026-07-09 08:09:42'),(14,4,11,'Goat Meat(Ogunfe)',1,2500.00,'2026-07-09 08:09:44'),(15,4,4,'Eva Table Water',1,400.00,'2026-07-09 08:09:44'),(16,5,16,'Beef',1,500.00,'2026-07-09 08:16:28'),(17,8,19,'Amala',1,300.00,'2026-07-09 11:33:21'),(18,7,19,'Amala',1,300.00,'2026-07-09 11:33:21'),(19,6,19,'Amala',1,300.00,'2026-07-09 11:33:21'),(20,8,16,'Beef',1,500.00,'2026-07-09 11:33:23'),(21,8,15,'Bush Meat',1,5000.00,'2026-07-09 11:33:23'),(22,6,16,'Beef',1,500.00,'2026-07-09 11:33:35'),(23,7,15,'Bush Meat',1,5000.00,'2026-07-09 11:33:35'),(24,7,16,'Beef',1,500.00,'2026-07-09 11:33:35'),(25,6,15,'Bush Meat',1,5000.00,'2026-07-09 11:33:36'),(26,9,16,'Beef',1,500.00,'2026-07-09 11:33:36'),(27,9,15,'Bush Meat',1,5000.00,'2026-07-09 11:33:36'),(28,9,19,'Amala',1,300.00,'2026-07-09 11:33:36'),(29,10,16,'Beef',1,500.00,'2026-07-09 11:33:36'),(30,10,19,'Amala',1,300.00,'2026-07-09 11:33:36'),(31,10,15,'Bush Meat',1,5000.00,'2026-07-09 11:33:36'),(32,11,19,'Amala',1,300.00,'2026-07-09 13:36:43'),(33,11,16,'Beef',1,500.00,'2026-07-09 13:36:43'),(34,11,15,'Bush Meat',1,5000.00,'2026-07-09 13:36:43'),(35,12,19,'Amala',1,300.00,'2026-07-09 13:52:46'),(36,12,7,'5 Alive Active',1,2500.00,'2026-07-09 13:52:46'),(37,12,2,'Fanta',1,700.00,'2026-07-09 13:52:46'),(38,12,4,'Eva Table Water',1,400.00,'2026-07-09 13:52:47');
/*!40000 ALTER TABLE `order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `status` enum('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
  `total_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `cashier_id` int DEFAULT NULL,
  `payments` text,
  `discount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `tax` decimal(10,2) NOT NULL DEFAULT '0.00',
  `subtotal` decimal(10,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
INSERT INTO `orders` VALUES (1,'completed',3655.00,'2026-07-08 17:18:26',4,'{\"Card\":3655}',0.00,255.00,3400.00),(2,'completed',4100.00,'2026-07-08 17:41:53',4,'{\"Cash\":4100}',0.00,0.00,4100.00),(3,'completed',8300.00,'2026-07-09 02:33:40',4,'{\"Transfer\":8300}',0.00,0.00,8300.00),(4,'completed',3800.00,'2026-07-09 08:09:42',4,'{\"Transfer\":3800}',0.00,0.00,3800.00),(5,'completed',500.00,'2026-07-09 08:16:27',4,'{\"Transfer\":500}',0.00,0.00,500.00),(6,'completed',5800.00,'2026-07-09 11:32:57',4,'{\"Card\":5800}',0.00,0.00,5800.00),(7,'completed',5800.00,'2026-07-09 11:33:08',4,'{\"Card\":5800}',0.00,0.00,5800.00),(8,'completed',5800.00,'2026-07-09 11:33:17',4,'{\"Card\":5800}',0.00,0.00,5800.00),(9,'completed',5800.00,'2026-07-09 11:33:36',4,'{\"Card\":5800}',0.00,0.00,5800.00),(10,'completed',5800.00,'2026-07-09 11:33:36',4,'{\"Card\":5800}',0.00,0.00,5800.00),(11,'completed',5800.00,'2026-07-09 13:36:43',4,'{\"Transfer\":5800}',0.00,0.00,5800.00),(12,'completed',3900.00,'2026-07-09 13:52:46',4,'{\"Cash\":3900}',0.00,0.00,3900.00);
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `stock` int NOT NULL DEFAULT '0',
  `status` varchar(50) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `category_id` (`category_id`),
  CONSTRAINT `products_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,1,'Pepsi',600.00,30,'Available',NULL,'2026-07-03 18:46:38'),(2,1,'Fanta',700.00,10,'Available',NULL,'2026-07-03 18:53:31'),(3,1,'Sprite',800.00,20,'Available',NULL,'2026-07-03 19:03:57'),(4,1,'Eva Table Water',400.00,20,'Available',NULL,'2026-07-03 19:22:59'),(5,1,'Trophy Lager Beer',1500.00,20,'Available',NULL,'2026-07-03 19:28:46'),(6,2,'Jollof Rice',500.00,12,'Available',NULL,'2026-07-04 03:18:28'),(7,1,'5 Alive Active',2500.00,30,'Available',NULL,'2026-07-04 03:44:19'),(8,1,'Pulpy Berry Blast',1500.00,20,'Available',NULL,'2026-07-04 03:45:39'),(9,2,'Fried Rice',500.00,20,'Available',NULL,'2026-07-05 20:19:50'),(10,2,'White Rice',400.00,100,'Available',NULL,'2026-07-09 02:01:11'),(11,4,'Goat Meat(Ogunfe)',2500.00,20,'Available',NULL,'2026-07-09 02:02:28'),(12,4,'Turkey(Large)',4500.00,20,'Available',NULL,'2026-07-09 02:03:04'),(13,4,'Chicken(Drum Stick)',2000.00,15,'Available',NULL,'2026-07-09 02:03:43'),(14,4,'Full Chicken',10000.00,5,'Available',NULL,'2026-07-09 02:04:20'),(15,4,'Bush Meat',5000.00,5,'Available',NULL,'2026-07-09 02:04:53'),(16,4,'Beef',500.00,50,'Available',NULL,'2026-07-09 02:05:18'),(17,4,'Ponmo',500.00,50,'Available',NULL,'2026-07-09 02:05:43'),(18,6,'Salad',500.00,30,'Available',NULL,'2026-07-09 02:06:31'),(19,3,'Amala',300.00,30,'Available',NULL,'2026-07-09 02:07:08'),(20,3,'Semo',300.00,30,'Available',NULL,'2026-07-09 02:07:26'),(21,3,'Pounded Yam(IYAN)',500.00,30,'Available',NULL,'2026-07-09 02:07:57'),(22,1,'Hollandia Youghurt',2500.00,30,'Available',NULL,'2026-07-09 02:08:53'),(23,1,'Coca-Cola(Can)',600.00,30,'Available',NULL,'2026-07-09 02:09:25');
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(64) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('manager','cashier') NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `full_name` varchar(128) DEFAULT '',
  `status` enum('Active','Inactive') NOT NULL DEFAULT 'Active',
  `last_seen` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'manager1','$2b$10$QmbWzmIuBZOhm6oNOmNKIuPChd2Xa8twl7UqvcazSVGL36kynD5Wa','manager','2026-07-03 08:59:22','','Active','2026-07-07 07:42:42'),(2,'cashier1','$2b$10$QmbWzmIuBZOhm6oNOmNKIuPChd2Xa8twl7UqvcazSVGL36kynD5Wa','cashier','2026-07-03 08:59:22','','Active','2026-07-07 07:42:42'),(3,'Neido','$2b$10$Ro364Wf6BP/Xtq31jc4cvuDHFaLjnKe69jAz5hCIel2JirJUxbKa.','manager','2026-07-03 12:45:50','Idowu Olaniyi','Active','2026-07-09 14:26:38'),(4,'Atiyat','$2b$10$D1YAXiVPMkA.5GDRnaWrOuyYlih3H5VSJWhxhU0CfXa8ZXIuJ7jO2','cashier','2026-07-07 01:23:31','Ada Johnson','Active','2026-07-09 13:35:24');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-09 18:13:15
